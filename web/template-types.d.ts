/**
 * Template system types (canonical).
 *
 * الهدف: تعريف شكل القالب (Template) بشكل معياري بحيث:
 * - المستخدم يقرأ القوالب ويبدأ "دراسة"
 * - الأدمن فقط يحرّر القوالب (عبر سياسات قاعدة البيانات)
 */

export type ID = string;

export type CountryCode = "SA";
export type Domain = "restaurants";

export type TemplateStatus = "draft" | "published" | "archived";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "boolean"
  | "date"
  | "select";

export type FieldSource = "user" | "computed" | "template";

export type FieldOption = {
  label: string;
  value: string;
};

export type FieldValidation = {
  /** Optional numeric constraints (when applicable). */
  min?: number;
  max?: number;
  step?: number;
  /** Optional list of allowed values (primarily for select/text enums). */
  allowedValues?: string[];
};

export type Field = {
  /** Stable key used for storage + mapping + formulas. */
  key: string;
  /** Human label shown in UI (Arabic/English allowed). */
  label: string;
  type: FieldType;

  /** Optional unit shown next to the field (e.g., "SAR", "%", "طلبات/يوم"). */
  unit?: string;
  /** UI help text (tooltip/description). */
  helpText?: string;

  required?: boolean;
  source?: FieldSource;
  defaultValue?: string | number | boolean | null;

  /**
   * Excel integration:
   * - If this field maps to a Named Range in the workbook, set it here.
   */
  namedRange?: string;

  /**
   * Computation hook:
   * - For computed fields only. Keep formulas declarative and audited.
   * - Example: "orders_per_day * avg_ticket * 30"
   */
  formula?: string;

  /** For select fields. */
  options?: FieldOption[];
  validation?: FieldValidation;
};

export type Table = {
  id: ID;
  title: string;
  description?: string;

  /**
   * Table columns (fields). These are repeated per row.
   * Example: OPEX table rows: item, monthly_cost, inflation_rate, notes...
   */
  columns: Field[];

  /** If true, UI allows adding/removing rows. */
  allowAddRemoveRows?: boolean;
  /** Optional default rows (as a list of objects keyed by Field.key). */
  defaultRows?: Array<Record<string, string | number | boolean | null>>;
};

export type SectionKind =
  | "identity"
  | "demand_sales"
  | "menu_cogs"
  | "opex"
  | "capex"
  | "financing"
  | "tax"
  | "engine"
  | "outputs"
  | "qa";

export type Section = {
  id: ID;
  title: string;
  description?: string;
  order: number;
  kind: SectionKind;

  /** Single-value fields (e.g., average ticket, hours per day). */
  fields?: Field[];
  /** Tabular inputs (e.g., OPEX, CAPEX, staffing plan). */
  tables?: Table[];
};

export type TemplateScope = {
  country: CountryCode;
  domain: Domain;
};

export type TemplateDefinition = {
  /** Template ID inside definition (may mirror DB id). */
  id: ID;
  /** Human name shown in UI. */
  name: string;
  /** Stable slug used in URLs/DB uniqueness. */
  slug: string;

  /** Semantic version for the definition schema/content. */
  version: string; // e.g., "1.0.0"

  scope: TemplateScope;

  /**
   * High-level model knobs for scenario/sensitivity defaults.
   * Keep these minimal; the rest should live in sections/tables/fields.
   */
  defaults?: Record<string, string | number | boolean | null>;

  sections: Section[];

  /**
   * QA gate rules are declared here (engine enforces them).
   * Example entries:
   * - { id, title, severity: "blocker", expression: "orders*avg_ticket == revenue" }
   */
  qa?: Array<{
    id: ID;
    title: string;
    severity: "blocker" | "warning";
    expression: string;
    message?: string;
  }>;

  meta?: {
    createdAt?: string;
    updatedAt?: string;
    notes?: string;
  };
};

/**
 * DB record shape (what you store in the `templates` table).
 * `definition` is the canonical JSONB payload.
 */
export type TemplateRecord = {
  id: ID;
  slug: string;
  name: string;
  description?: string | null;
  country_code: CountryCode;
  domain: Domain;
  status: TemplateStatus;
  definition: TemplateDefinition;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  created_by?: ID | null;
  updated_by?: ID | null;
};

