/**
 * Extract Excel templates -> TemplateDefinition JSON -> upload to `templates` table.
 *
 * Input:
 * - /assets/templates/excel/قالب_دراسة_الجدوى_المعياري.xlsx
 * - /assets/templates/excel/دراسة الجدوى لماك بلاش.xlsx
 *
 * Output:
 * - /assets/templates/definitions/<slug>.definition.json
 *
 * Upload (optional, Supabase):
 * - set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * تشغيل مقترح:
 * - npm i xlsx @supabase/supabase-js
 * - npx tsx scripts/extract-excel-templates.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TemplateDefinition, TemplateStatus } from "../web/template-types";

type Workbook = {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
};

type Sheet2D = Array<Array<string | number | boolean | null | undefined>>;

type FoundTable = {
  sheetName: string;
  headerRowIndex: number;
  headerColIndex: number;
  headers: string[];
  rows: Sheet2D;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const EXCEL_DIR = path.join(ROOT, "assets", "templates", "excel");
const DEF_DIR = path.join(ROOT, "assets", "templates", "definitions");

const STANDARD_EXCEL = "قالب_دراسة_الجدوى_المعياري.xlsx";
const MACBLASH_EXCEL = "دراسة الجدوى لماك بلاش.xlsx";

function normalizeCell(v: unknown): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  // ExcelJS-like rich values, or objects from xlsx: try common props
  if (typeof v === "object") {
    const anyV = v as any;
    if (typeof anyV.v === "string" || typeof anyV.v === "number" || typeof anyV.v === "boolean") {
      return normalizeCell(anyV.v);
    }
    if (typeof anyV.w === "string") return normalizeCell(anyV.w);
  }
  return null;
}

function to2D(wsJson: unknown): Sheet2D {
  // xlsx.utils.sheet_to_json(ws, { header: 1, raw: false })
  if (!Array.isArray(wsJson)) return [];
  return (wsJson as unknown[]).map((row) => {
    if (!Array.isArray(row)) return [];
    return (row as unknown[]).map(normalizeCell);
  });
}

function cellToString(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

function rowHasAll(row: Array<string | number | boolean | null | undefined>, needles: string[]): boolean {
  const rowText = row.map(cellToString);
  return needles.every((n) => rowText.some((c) => c === n || c.includes(n)));
}

function findTableByHeaders(sheets: Record<string, Sheet2D>, headerNeedles: string[]): FoundTable | null {
  for (const [sheetName, grid] of Object.entries(sheets)) {
    for (let r = 0; r < Math.min(grid.length, 200); r++) {
      const row = grid[r] ?? [];
      if (!row.length) continue;

      if (rowHasAll(row, headerNeedles)) {
        // Find left-most header cell index
        const headerStrings = row.map(cellToString);
        const headerColIndex = headerStrings.findIndex((c) => c.length > 0);

        // Extract subsequent rows until first column is empty (soft stop)
        const rows: Sheet2D = [];
        for (let rr = r + 1; rr < grid.length; rr++) {
          const dataRow = grid[rr] ?? [];
          const first = cellToString(dataRow[headerColIndex]);
          const allEmpty = dataRow.map(cellToString).every((x) => x === "");
          if (allEmpty) break;
          if (first === "") break;
          // Keep the table aligned from the detected header start column.
          rows.push(dataRow.slice(Math.max(0, headerColIndex)));
        }

        return {
          sheetName,
          headerRowIndex: r,
          headerColIndex: Math.max(0, headerColIndex),
          headers: headerStrings,
          rows,
        };
      }
    }
  }
  return null;
}

function safeSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_.]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function loadXlsx(): Promise<any> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return await import("xlsx");
  } catch {
    throw new Error('Missing dependency "xlsx". Install it: npm i xlsx');
  }
}

async function readWorkbook(filePath: string): Promise<{ workbook: Workbook; sheets2d: Record<string, Sheet2D> }> {
  const xlsx = await loadXlsx();
  const workbook: Workbook = xlsx.readFile(filePath, { cellDates: false, cellNF: false });

  const sheets2d: Record<string, Sheet2D> = {};
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const grid = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false });
    sheets2d[name] = to2D(grid);
  }
  return { workbook, sheets2d };
}

function buildStandardTemplateFromWorkbook(sheets2d: Record<string, Sheet2D>): TemplateDefinition {
  // 1) Assumptions: (البند/القيمة/الوحدة/الملاحظة)
  const assumptionsTable = findTableByHeaders(sheets2d, ["البند", "القيمة"]);

  // 2) Initial investment: Sections + items (qty, price, total, source)
  const capexTable =
    findTableByHeaders(sheets2d, ["الكمية", "السعر"]) ??
    findTableByHeaders(sheets2d, ["qty", "price"]);

  // 3) Revenue sources + 5 years
  const revenueTable =
    findTableByHeaders(sheets2d, ["المصدر", "سنة"]) ??
    findTableByHeaders(sheets2d, ["source", "year"]);

  // Basic QA blocks (restaurant-flavored)
  const qa = [
    {
      id: "qa-revenue-consistency",
      title: "اتساق الإيراد",
      severity: "blocker" as const,
      expression: "orders_per_day * avg_ticket * days_per_period == revenue_total",
      message: "تحقق أن (عدد الطلبات × متوسط الفاتورة × أيام الفترة) يساوي الإيراد المتوقع.",
    },
  ];

  return {
    id: "tmpl_standard_restaurants_sa_v1",
    name: "قالب دراسة جدوى (مطاعم السعودية) — معياري",
    slug: "restaurants-sa-standard",
    version: "1.0.0",
    scope: { country: "SA", domain: "restaurants" },
    sections: [
      {
        id: "sec_assumptions",
        title: "الافتراضات",
        description: assumptionsTable
          ? `مستخرج من الشيت: ${assumptionsTable.sheetName}`
          : "افتراضات عامة (تُستخرج من نموذج الإكسل).",
        order: 10,
        kind: "identity",
        tables: [
          {
            id: "tbl_assumptions",
            title: "جدول الافتراضات",
            description: "صفوف (البند/القيمة/الوحدة/الملاحظة).",
            allowAddRemoveRows: true,
            columns: [
              { key: "item", label: "البند", type: "text", required: true },
              { key: "value", label: "القيمة", type: "text", required: true },
              { key: "unit", label: "الوحدة", type: "text" },
              { key: "note", label: "الملاحظة", type: "text" },
            ],
            defaultRows: assumptionsTable
              ? assumptionsTable.rows.map((r) => ({
                  item: cellToString(r[0]),
                  value: cellToString(r[1]),
                  unit: cellToString(r[2]),
                  note: cellToString(r[3]),
                }))
              : [],
          },
        ],
      },
      {
        id: "sec_capex",
        title: "الاستثمار الأولي (CAPEX)",
        description: capexTable
          ? `مستخرج من الشيت: ${capexTable.sheetName}`
          : "بنود الاستثمار الأولي: qty/price/total/source.",
        order: 20,
        kind: "capex",
        tables: [
          {
            id: "tbl_capex_items",
            title: "بنود الاستثمار",
            description: "Sections + Items (qty, price, total, source).",
            allowAddRemoveRows: true,
            columns: [
              { key: "section", label: "القسم", type: "text" },
              { key: "item", label: "البند", type: "text", required: true },
              { key: "qty", label: "الكمية", type: "number" },
              { key: "price", label: "السعر", type: "currency", unit: "SAR" },
              { key: "total", label: "الإجمالي", type: "currency", unit: "SAR", source: "computed" },
              { key: "source", label: "المصدر", type: "text" },
            ],
            defaultRows: capexTable
              ? capexTable.rows.map((r) => ({
                  section: null,
                  item: cellToString(r[0]),
                  qty: typeof r[1] === "number" ? r[1] : cellToString(r[1]),
                  price: typeof r[2] === "number" ? r[2] : cellToString(r[2]),
                  total: typeof r[3] === "number" ? r[3] : cellToString(r[3]),
                  source: cellToString(r[4]),
                }))
              : [],
          },
        ],
      },
      {
        id: "sec_revenue",
        title: "الإيرادات (مصادر + 5 سنوات)",
        description: revenueTable
          ? `مستخرج من الشيت: ${revenueTable.sheetName}`
          : "مصادر الإيراد عبر 5 سنوات.",
        order: 30,
        kind: "demand_sales",
        tables: [
          {
            id: "tbl_revenue_sources",
            title: "مصادر الإيراد",
            allowAddRemoveRows: true,
            columns: [
              { key: "source", label: "المصدر", type: "text", required: true },
              { key: "y1", label: "سنة 1", type: "currency", unit: "SAR" },
              { key: "y2", label: "سنة 2", type: "currency", unit: "SAR" },
              { key: "y3", label: "سنة 3", type: "currency", unit: "SAR" },
              { key: "y4", label: "سنة 4", type: "currency", unit: "SAR" },
              { key: "y5", label: "سنة 5", type: "currency", unit: "SAR" },
            ],
            defaultRows: revenueTable
              ? revenueTable.rows.map((r) => ({
                  source: cellToString(r[0]),
                  y1: typeof r[1] === "number" ? r[1] : cellToString(r[1]),
                  y2: typeof r[2] === "number" ? r[2] : cellToString(r[2]),
                  y3: typeof r[3] === "number" ? r[3] : cellToString(r[3]),
                  y4: typeof r[4] === "number" ? r[4] : cellToString(r[4]),
                  y5: typeof r[5] === "number" ? r[5] : cellToString(r[5]),
                }))
              : [],
          },
        ],
      },
      {
        id: "sec_outputs",
        title: "المخرجات (KPIs)",
        description: "مؤشرات التقييم: outputs",
        order: 90,
        kind: "outputs",
        fields: [
          { key: "npv", label: "NPV", type: "currency", unit: "SAR", source: "computed" },
          { key: "irr", label: "IRR", type: "percent", unit: "%", source: "computed" },
          { key: "payback", label: "Payback", type: "number", unit: "سنوات", source: "computed" },
          { key: "breakeven", label: "Breakeven", type: "number", source: "computed" },
        ],
      },
      {
        id: "sec_qa",
        title: "QA / Sensitivity / Scenarios",
        description: "السيناريوهات/الحساسية/المراجعة: تتحول لوحدات جاهزة.",
        order: 100,
        kind: "qa",
        fields: [
          { key: "scenario", label: "السيناريو", type: "select", options: [
            { label: "Base", value: "base" },
            { label: "Best", value: "best" },
            { label: "Worst", value: "worst" },
          ], defaultValue: "base" },
        ],
      },
    ],
    qa,
  };
}

function extractModuleBlock(sheets2d: Record<string, Sheet2D>, moduleTitle: string): Array<{ item: string; note: string | null }> {
  // Heuristic: find a row containing moduleTitle, then capture following non-empty rows (first col)
  for (const [, grid] of Object.entries(sheets2d)) {
    for (let r = 0; r < Math.min(grid.length, 500); r++) {
      const row = grid[r] ?? [];
      const rowText = row.map(cellToString).join(" | ");
      if (!rowText.includes(moduleTitle)) continue;

      const out: Array<{ item: string; note: string | null }> = [];
      for (let rr = r + 1; rr < grid.length; rr++) {
        const dataRow = grid[rr] ?? [];
        const first = cellToString(dataRow[0]);
        const allEmpty = dataRow.map(cellToString).every((x) => x === "");
        if (allEmpty) break;
        if (!first) break;
        out.push({ item: first, note: cellToString(dataRow[1]) || null });
      }
      return out;
    }
  }
  return [];
}

function buildMacBlashTemplateFromWorkbook(sheets2d: Record<string, Sheet2D>): TemplateDefinition {
  const marketing = extractModuleBlock(sheets2d, "التسوي");
  const legal = extractModuleBlock(sheets2d, "القانون");
  const technical = extractModuleBlock(sheets2d, "الفني");
  const hr = extractModuleBlock(sheets2d, "الموارد");

  const moduleToRows = (rows: Array<{ item: string; note: string | null }>) =>
    rows.map((r) => ({ item: r.item, note: r.note ?? "" }));

  return {
    id: "tmpl_macblash_restaurants_sa_v1",
    name: "قالب وحدات (ماك بلاش) — قابل لإعادة التسمية للمطاعم",
    slug: "restaurants-sa-modules-macblash",
    version: "1.0.0",
    scope: { country: "SA", domain: "restaurants" },
    sections: [
      {
        id: "sec_modules_marketing",
        title: "الوحدة التسويقية (قابلة لإعادة التسمية)",
        description: "مستخرجة من ماك بلاش (التسويقية).",
        order: 10,
        kind: "identity",
        tables: [
          {
            id: "tbl_marketing",
            title: "بنود تسويقية",
            allowAddRemoveRows: true,
            columns: [
              { key: "item", label: "البند", type: "text", required: true },
              { key: "note", label: "ملاحظة", type: "textarea" },
            ],
            defaultRows: moduleToRows(marketing),
          },
        ],
      },
      {
        id: "sec_modules_legal",
        title: "الوحدة القانونية (قابلة لإعادة التسمية)",
        description: "مستخرجة من ماك بلاش (القانونية).",
        order: 20,
        kind: "identity",
        tables: [
          {
            id: "tbl_legal",
            title: "بنود قانونية",
            allowAddRemoveRows: true,
            columns: [
              { key: "item", label: "البند", type: "text", required: true },
              { key: "note", label: "ملاحظة", type: "textarea" },
            ],
            defaultRows: moduleToRows(legal),
          },
        ],
      },
      {
        id: "sec_modules_technical",
        title: "الوحدة الفنية (قابلة لإعادة التسمية)",
        description: "مستخرجة من ماك بلاش (الفنية).",
        order: 30,
        kind: "identity",
        tables: [
          {
            id: "tbl_technical",
            title: "بنود فنية",
            allowAddRemoveRows: true,
            columns: [
              { key: "item", label: "البند", type: "text", required: true },
              { key: "note", label: "ملاحظة", type: "textarea" },
            ],
            defaultRows: moduleToRows(technical),
          },
        ],
      },
      {
        id: "sec_modules_hr",
        title: "وحدة الموارد (قابلة لإعادة التسمية)",
        description: "مستخرجة من ماك بلاش (الموارد).",
        order: 40,
        kind: "identity",
        tables: [
          {
            id: "tbl_hr",
            title: "بنود موارد",
            allowAddRemoveRows: true,
            columns: [
              { key: "item", label: "البند", type: "text", required: true },
              { key: "note", label: "ملاحظة", type: "textarea" },
            ],
            defaultRows: moduleToRows(hr),
          },
        ],
      },
    ],
    qa: [],
  };
}

type UploadConfig = {
  url: string;
  serviceRoleKey: string;
  status: TemplateStatus;
};

async function uploadTemplates(config: UploadConfig, defs: TemplateDefinition[]) {
  let supabaseMod: any;
  try {
    supabaseMod = await import("@supabase/supabase-js");
  } catch {
    throw new Error('Missing dependency "@supabase/supabase-js". Install it: npm i @supabase/supabase-js');
  }

  const supabase = supabaseMod.createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = defs.map((d) => ({
    slug: d.slug,
    name: d.name,
    description: null,
    country_code: d.scope.country,
    domain: d.scope.domain,
    status: config.status,
    template_id: d.id,
    template_version: d.version,
    definition: d,
    published_at: config.status === "published" ? new Date().toISOString() : null,
  }));

  // Check existence to prevent overwriting existing version
  for (const row of rows) {
    const { data: existing } = await supabase
      .from("templates")
      .select("template_id, template_version")
      .eq("template_id", row.template_id)
      .eq("template_version", row.template_version)
      .maybeSingle();

    if (existing) {
      // eslint-disable-next-line no-console
      console.warn(`Skipping existing template version: ${row.template_id} @ ${row.template_version}`);
      continue;
    }

    const { error } = await supabase.from("templates").insert(row);
    if (error) throw new Error(`Upload failed for ${row.template_id}: ${error.message}`);
  }
}

async function main() {
  ensureDir(DEF_DIR);

  const standardPath = path.join(EXCEL_DIR, STANDARD_EXCEL);
  const macblashPath = path.join(EXCEL_DIR, MACBLASH_EXCEL);

  if (!fs.existsSync(standardPath)) {
    throw new Error(`Excel file not found: ${standardPath}`);
  }
  if (!fs.existsSync(macblashPath)) {
    throw new Error(`Excel file not found: ${macblashPath}`);
  }

  const standard = await readWorkbook(standardPath);
  const macblash = await readWorkbook(macblashPath);

  const standardDef = buildStandardTemplateFromWorkbook(standard.sheets2d);
  const macblashDef = buildMacBlashTemplateFromWorkbook(macblash.sheets2d);

  // Keep a stable "latest" file path (used by the static web UI),
  // and also write a versioned copy for audit/history.
  const out1Latest = path.join(DEF_DIR, `${safeSlug(standardDef.slug)}.definition.json`);
  const out2Latest = path.join(DEF_DIR, `${safeSlug(macblashDef.slug)}.definition.json`);
  const out1Versioned = path.join(DEF_DIR, `${safeSlug(standardDef.slug)}.v${safeSlug(standardDef.version)}.definition.json`);
  const out2Versioned = path.join(DEF_DIR, `${safeSlug(macblashDef.slug)}.v${safeSlug(macblashDef.version)}.definition.json`);

  writeJson(out1Latest, standardDef);
  writeJson(out2Latest, macblashDef);
  writeJson(out1Versioned, standardDef);
  writeJson(out2Versioned, macblashDef);

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const status = (process.env.TEMPLATE_STATUS?.trim() as TemplateStatus) || "published";

  if (url && key) {
    await uploadTemplates({ url, serviceRoleKey: key, status }, [standardDef, macblashDef]);
    // eslint-disable-next-line no-console
    console.log("Uploaded templates to DB table: templates");
  } else {
    // eslint-disable-next-line no-console
    console.log("Skipped upload (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable).");
  }

  // eslint-disable-next-line no-console
  console.log("Wrote definitions:", out1Latest, out1Versioned, out2Latest, out2Versioned);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

