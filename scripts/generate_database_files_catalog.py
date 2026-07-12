"""Build the browser catalogue for the database files library."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "ملفات قواعد البيانات"
OUTPUT = ROOT / "web" / "public" / "data" / "database-files.json"

GROUP_META = {
    "أجهزة طبية": ("الأجهزة الطبية", "قواعد بيانات الجهات والشركات العاملة في مجال الأجهزة الطبية."),
    "إستقدام": ("مكاتب الاستقدام", "دليل مكاتب الاستقدام وبيانات التواصل معها."),
    "أسرار الإشتراكات الرقمية": ("الاشتراكات الرقمية", "مادة مرجعية عن الاشتراكات والخدمات الرقمية."),
    "المطاعم والكافيهات": ("المطاعم والمقاهي", "بيانات المطاعم والمقاهي ومعلومات التواصل والتصنيف."),
    "دليل المتاجر الإلكترونية": ("المتاجر الإلكترونية", "دليل المتاجر الإلكترونية والأنشطة المسجلة."),
    "دليل المصانع السعودية": ("المصانع السعودية", "دليل المصانع السعودية وبياناتها التعريفية."),
    "دليل شركات المقاولات": ("شركات المقاولات", "بيانات شركات المقاولات ومواقعها ووسائل التواصل."),
    "شركات ادارية وبرمجية": ("الشركات الإدارية والبرمجية", "بيانات الشركات الإدارية والبرمجية والخدمات التي تقدمها."),
    "مصانع الأعلاف": ("مصانع الأعلاف", "بيانات مصانع الأعلاف والجهات العاملة في القطاع."),
    "مصانع الدواء": ("مصانع الأدوية", "بيانات مصانع الأدوية والجهات المرخصة في القطاع."),
    "مصانع الغذاء": ("مصانع الأغذية", "بيانات مصانع ومستودعات الأغذية."),
    "مكاتب هندسية": ("المكاتب الهندسية", "دليل المكاتب الهندسية وبيانات الاتصال بها."),
    "مؤسسات عطور وبخور": ("العطور والبخور", "بيانات المؤسسات العاملة في العطور والبخور والعود."),
}

FORMAT_META = {
    ".xlsx": ("جدول بيانات", "جدول"),
    ".xls": ("جدول بيانات", "جدول"),
    ".csv": ("جدول بيانات", "جدول"),
    ".pdf": ("وثيقة", "وثيقة"),
}

# مجلدات وُجدت أثناء التدقيق ضمن مجلد المصدر لكن محتواها ليس قاعدة بيانات
# منشآت/شركات مثل بقية المجلدات — تُستبعد من الفهرس دون حذفها من المصدر.
SKIP_FOLDERS = {
    # كتيّب "إعادة بيع اشتراكات رقمية" (نتفلكس/أوفيس...)، وليس قاعدة بيانات منشآت
    "أسرار الإشتراكات الرقمية",
}

EXCLUDED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".mp4", ".gif"}


def clean_name(value: str) -> str:
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Cf")
    value = value.replace("_", " ").replace("-", " ")
    value = re.sub(r"\s+", " ", value).strip(" .")
    value = re.sub(r"\bsample\b", "نسخة تجريبية", value, flags=re.IGNORECASE)
    value = re.sub(r"\bcopy\b", "نسخة", value, flags=re.IGNORECASE)
    value = re.sub(r"\bFood\s+truck\b", "عربة طعام", value, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", value).strip(" .")


def size_label(size: int) -> str:
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} ميجابايت"
    return f"{max(1, round(size / 1024))} كيلوبايت"


def is_uuid_stem(stem: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", stem, flags=re.IGNORECASE))


def file_title(path: Path, group_label: str, ordinal: int) -> str:
    stem = clean_name(path.stem)
    if is_uuid_stem(path.stem):
        return f"صورة توضيحية رقم {ordinal}"
    if not stem or re.search(r"[A-Za-z]", stem):
        return f"ملف بيانات {group_label}"
    return stem


def build_catalog() -> dict:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"لم يُعثر على مجلد قواعد البيانات: {SOURCE_ROOT}")

    groups = []
    total_files = 0
    for folder in sorted((path for path in SOURCE_ROOT.iterdir() if path.is_dir()), key=lambda item: item.name.casefold()):
        if folder.name in SKIP_FOLDERS:
            continue
        group_label, description = GROUP_META.get(folder.name, (folder.name, "ملفات وقواعد بيانات جاهزة للتحميل."))
        files = []
        image_ordinal = 0
        for path in sorted(folder.rglob("*"), key=lambda item: str(item.relative_to(folder)).casefold()):
            if not path.is_file() or path.name.startswith("~$"):
                continue
            extension = path.suffix.lower()
            if extension in EXCLUDED_EXTENSIONS:
                continue
            format_label, format_id = FORMAT_META.get(extension, ("ملف", "ملف"))
            title = file_title(path, group_label, image_ordinal or len(files) + 1)
            relative = path.relative_to(SOURCE_ROOT).as_posix()
            encoded_url = "/databases/" + "/".join(quote(part, safe="") for part in relative.split("/"))
            files.append({
                "id": hashlib.sha1(relative.encode("utf-8")).hexdigest()[:12],
                "title": title,
                "filename": path.name,
                "format": format_id,
                "formatLabel": format_label,
                "url": encoded_url,
                "downloadName": f"{title}{extension}",
                "sizeLabel": size_label(path.stat().st_size),
                "isSample": bool(re.search(r"sample|نسخة تجريبية", path.stem, flags=re.IGNORECASE)),
            })
        if not files:
            continue
        total_files += len(files)
        groups.append({
            "id": hashlib.sha1(folder.name.encode("utf-8")).hexdigest()[:12],
            "label": group_label,
            "sourceFolder": folder.name,
            "description": description,
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
    print(f"Generated {catalog['totalFiles']} database files in {catalog['totalGroups']} groups at {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
