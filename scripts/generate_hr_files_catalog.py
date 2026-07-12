"""Build the browser catalogue for the HR files library."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "ملفات الموارد البشرية" / "الموارد البشرية"
OUTPUT = ROOT / "web" / "public" / "data" / "hr-files.json"

FORMAT_META = {
    ".xlsx": ("جدول بيانات", "جدول"),
    ".xls": ("جدول بيانات", "جدول"),
    ".csv": ("جدول بيانات", "جدول"),
    ".docx": ("مستند نصي", "مستند"),
    ".doc": ("مستند نصي", "مستند"),
    ".pdf": ("وثيقة", "وثيقة"),
    ".pptx": ("عرض تقديمي", "عرض"),
    ".ppt": ("عرض تقديمي", "عرض"),
    ".accdb": ("قاعدة بيانات", "قاعدة"),
    ".rar": ("ملف مضغوط", "أرشيف"),
    ".zip": ("ملف مضغوط", "أرشيف"),
}

EXCLUDED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".mp4", ".gif", ".rar", ".zip"}

# أسماء المجلدات الفرعية إنجليزية خام (وبعضها بها أخطاء إملائية مثل
# "Anuual_Leave_"/"Planing") — تُترجم هنا بدل تسريبها حرفياً لواجهة عربية.
LABEL_OVERRIDES = {
    "Anuual_Leave_": "الإجازات السنوية",
    "JOB DESCRIPTION": "الوصف الوظيفي",
    "Organizational Chart": "الهيكل التنظيمي",
    "Planing": "التخطيط الاستراتيجي",
    "Report": "التقارير",
    # يبقى الاختصار بين قوسين بعد المصطلح العربي — نمط web/app.js:87 المحمي من
    # معرِّب الواجهة العام (وإلا يتحول "تحليل SWOT" إلى "تحليل التحليل الرباعي").
    "SWOT Analysis": "التحليل الرباعي (SWOT)",
    "kpi & kpa": "مؤشرات الأداء (KPI)",
    "payroll": "الرواتب",
    "salary scale": "سلم الرواتب",
}

# مجلد بملف واحد مكرر بالكامل ومحتواه موجود أصلاً داخل مجلد "شؤون عاملين" —
# يُستبعد لتفادي ظهور مجموعة كاملة لملف واحد مكرر.
SKIP_FOLDERS = {"قوانين العمل"}

def size_label(size: int) -> str:
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} ميجابايت"
    return f"{max(1, round(size / 1024))} كيلوبايت"

def build_catalog() -> dict:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"لم يُعثر على مجلد الموارد البشرية: {SOURCE_ROOT}")

    groups = []
    total_files = 0
    
    # We will treat the direct subfolders of SOURCE_ROOT as groups.
    # Files directly in SOURCE_ROOT will be put in a "ملفات عامة" group.
    
    general_files = []
    for path in sorted(SOURCE_ROOT.iterdir(), key=lambda item: item.name.casefold()):
        if path.is_file() and not path.name.startswith("~$"):
            general_files.append(path)
            
    if general_files:
        files = []
        for path in general_files:
            extension = path.suffix.lower()
            if extension in EXCLUDED_EXTENSIONS:
                continue
            format_label, format_id = FORMAT_META.get(extension, ("ملف", "ملف"))
            title = path.stem
            relative = path.relative_to(SOURCE_ROOT).as_posix()
            encoded_url = "/hr-files/" + "/".join(quote(part, safe="") for part in relative.split("/"))
            files.append({
                "id": hashlib.sha1(relative.encode("utf-8")).hexdigest()[:12],
                "title": title,
                "filename": path.name,
                "format": format_id,
                "formatLabel": format_label,
                "url": encoded_url,
                "downloadName": path.name,
                "sizeLabel": size_label(path.stat().st_size),
                "isSample": False,
            })
        total_files += len(files)
        groups.append({
            "id": hashlib.sha1(b"general").hexdigest()[:12],
            "label": "ملفات عامة متنوعة",
            "sourceFolder": "",
            "description": "ملفات عامة للموارد البشرية والتوظيف.",
            "count": len(files),
            "files": files,
        })

    for folder in sorted((path for path in SOURCE_ROOT.iterdir() if path.is_dir()), key=lambda item: item.name.casefold()):
        if folder.name in SKIP_FOLDERS:
            continue
        files = []
        for path in sorted(folder.rglob("*"), key=lambda item: str(item.relative_to(folder)).casefold()):
            if not path.is_file() or path.name.startswith("~$"):
                continue
            extension = path.suffix.lower()
            if extension in EXCLUDED_EXTENSIONS:
                continue
            format_label, format_id = FORMAT_META.get(extension, ("ملف", "ملف"))
            title = path.stem
            relative = path.relative_to(SOURCE_ROOT).as_posix()
            encoded_url = "/hr-files/" + "/".join(quote(part, safe="") for part in relative.split("/"))
            files.append({
                "id": hashlib.sha1(relative.encode("utf-8")).hexdigest()[:12],
                "title": title,
                "filename": path.name,
                "format": format_id,
                "formatLabel": format_label,
                "url": encoded_url,
                "downloadName": path.name,
                "sizeLabel": size_label(path.stat().st_size),
                "isSample": False,
            })
        if not files:
            continue
        total_files += len(files)
        label = LABEL_OVERRIDES.get(folder.name, folder.name)
        groups.append({
            "id": hashlib.sha1(folder.name.encode("utf-8")).hexdigest()[:12],
            "label": label,
            "sourceFolder": folder.name,
            "description": f"نماذج وملفات تتعلق بـ {label}",
            "count": len(files),
            "files": files,
        })

    return {
        "version": 1,
        "generatedAt": date.today().isoformat(),
        "sourceFolder": SOURCE_ROOT.name,
        "totalFiles": total_files,
        "totalGroups": len(groups),
        "groups": groups,
    }

def main() -> int:
    catalog = build_catalog()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {catalog['totalFiles']} HR files in {catalog['totalGroups']} groups at {OUTPUT}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
