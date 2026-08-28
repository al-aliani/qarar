"""Build the browser catalogue for the ready-made feasibility studies.

The source PDFs stay in the user-owned ``درسات جدوى`` folder.  This script
creates a small, searchable JSON index; the Vite plugin serves/copies the
source PDFs themselves at build time.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import quote

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - the workspace runtime includes pypdf
    PdfReader = None


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "درسات جدوى"
OUTPUT = ROOT / "web" / "public" / "data" / "ready-studies.json"

# ملفات وُجدت أثناء التدقيق ضمن مجلدات المصدر لكنها ليست دراسات جدوى لمشروع
# تجاري يفيد عميلاً سعودياً (أوراق أكاديمية/بحثية، تقارير حكومية أجنبية عامة،
# أو مواد نظرية عامة). تُستبعد من الفهرس دون حذفها من المصدر.
SKIP_FILES = {
    # تدقيق 2026-08-27: نفس ملف PDF بالضبط (نفس الحجم وعدد الصفحات) موجود مرتين
    # في مجلدين مختلفين ("الحي" و"مصنع") فيظهر للعميل كبطاقتين منفصلتين لدراسة
    # واحدة حرفياً. أُبقيت نسخة "الحي" (سبقتها أبجدياً) وحُذفت نسخة "مصنع" هنا.
    "مصنع/مشغل خياطة ثياب نسائية.pdf",
    # ورقة بحث أكاديمية عن اختبار ذكاء للأطفال العُمانيين، وليست دراسة مشروع
    "الحي/A Feasibility Study for Developing a Computerized Adaptive Form of Raven_s Colored Progressive Matrices Test for Omani Children Based on the Item Response Theory.pdf",
    # دراسة جدوى سكن طلابي لكلية أمريكية (Bellevue College) — غير ذات صلة
    "الحي/SDS-Study.pdf",
    # دراسة توسعة مركز مؤتمرات واشنطن (مشروع حكومي أمريكي ضخم) — غير ذات صلة
    "الحي/Summary_StudyFindings211.pdf",
    # كتاب نظري عام عن الجدوى الاقتصادية، وليس دراسة لمشروع فعلي
    "دراسة الجدوى/Economic-Feasibility-of-Development-Projects-Arabic.pdf",
    # ورقة بحثية من KAPSARC عن سياسات الطاقة الكلية بالسعودية، وليست دراسة جدوى لمشروع
    "دراسة الجدوى/KS-2019-DP54-KS-2019-DP54-النمو-من-خلال-التنوع-وكفاية-الطاقة-إنتاجية-الطاقة-في-المملكة-العربية-السعودية.pdf",
    # دراسة جدوى سكة حديد حكومية (لا علاقة بمصنع أو مشروع صغير)
    "مصنع/Rail railways.pdf",
    "مصنع/Rocky Mountain Rail Authority Rail Feasibility Study.pdf",
    # كتيّب تقارير خدمات مالية مصري، وليس دراسة جدوى مشروع
    "مصنع/Reports and Documents_2052021000_EG_Financial_Services_CRR_Booklet.pdf",
    # مقتطف نظري عام عن مراحل تطور الشركات الناشئة، وليس دراسة مشروع محدد
    "مصنع/Startup-Evolution-Curve_Excerpt-2017-05-31.pdf",
}

CATEGORY_META = {
    "أكل": ("food", "أطعمة ومشروبات", "مطاعم، مقاهٍ، حلويات، ومشاريع غذائية"),
    "الحي": ("retail-services", "تجارة وخدمات متنوعة", "تجارة التجزئة والخدمات والمشروعات المتنوعة"),
    "الرجال": ("mens", "أزياء وعناية رجالية", "أزياء وخدمات عناية موجهة للرجال"),
    "تأجير": ("leasing", "تأجير وخدمات معدات", "مشروعات التأجير والمكاتب والمعدات"),
    "دراسة الجدوى": ("misc", "دراسات متنوعة", "نماذج ودراسات متنوعة متعددة القطاعات"),
    "دراسة جدوى تعليم": ("education", "تعليم وتدريب", "نماذج تعليمية وتدريبية وإرشادية"),
    "سيارات": ("automotive", "سيارات ونقل", "خدمات السيارات والنقل والمواقف"),
    "طلاب": ("students", "خدمات الطلاب والمكاتب", "خدمات الطلاب والوثائق والمستلزمات المكتبية"),
    "كشك": ("kiosk", "أكشاك ومشاريع صغيرة", "مشروعات الأكشاك والعربات والمشروعات الخفيفة"),
    "مصنع": ("manufacturing-agriculture", "تصنيع وزراعة وثروة حيوانية", "مصانع وورش ومشروعات زراعية وحيوانية"),
    "مقاولات": ("construction", "مقاولات وإنشاءات", "أعمال المقاولات والخرسانة والأسقف"),
    "نساء": ("women", "أزياء وتجميل نسائي", "الأزياء والتجميل والمشروعات النسائية"),
}

TAG_RULES = [
    ("مطاعم ووجبات", r"مطعم|مطاعم|restaurant|fast\s*food|مأكولات|شاورما|برجر|برقر|كباب|سندوتش|سندويتش|سمك|fish"),
    ("مقاهٍ وكوفي", r"كوفي|كافيه|caffe|cafe|كافتريا|مقهى|coffee"),
    ("حلويات ومخابز", r"حلويات|كعك|مخبوز|مخبز|فطائر|فرن|معجنات|bakery|pancake"),
    ("أكشاك وعربات متنقلة", r"كشك|food\s*truck|عربة|متنقلة"),
    ("تجارة وتجزئة", r"تجارة|محل|بيع|سوبر\s*ماركت|ميني\s*ماركت|توكيل|معرض|متجر|wholesale|retail|mall|مول"),
    ("تصنيع", r"مصنع|تصنيع|manufactur|معمل|ورشة|صناعة|إنتاج|production|plant|factory"),
    ("بلاستيك وتدوير", r"بلاستيك|plastic|pvc|بولسترين|تدوير|إعادة\s*تدوير|recycling"),
    ("أغذية مصنّعة", r"أعلاف|مكرونة|عصائر|مربى|مخللات|جبن|ألبان|حلوى|زيتون|تمور|فواكه|خضار|بطاطس|حلاوة|مياه\s*معدنية"),
    ("زراعة", r"زراعة|زراعي|زراعية|مزرعة|صوبة|محصول|نخيل|تمور|فلفل|بندورة|عنب|بطاطا|أزهار|سمسم|زيتون|alfalfa|cultivation|farm"),
    ("ثروة حيوانية", r"حيوانات|حيوانية|عجول|ماشية|أغنام|اغنام|أرانب|ارانب|نحل|دواجن|أسماك|سمكية|fish\s*farm|poultry|calves|cage\s*farming"),
    ("سياحة وضيافة", r"فندق|فنادق|منتجع|سياحي|سياحة|شاليه|مخيم|قرية\s*سياحية|hotel|resort|tourism|village"),
    ("تعليم وتدريب", r"مدرسة|تعليم|تدريب|معهد|طلاب|مكتبة|متحف|museum|school|training|education"),
    ("صحة ورعاية", r"مستشفى|مركز\s*طبي|صحي|عيادة|رعاية\s*صحية|hospital|dermatology|medical|health"),
    ("سيارات ونقل", r"سيارة|سيارات|نقل|إطارات|اطارات|زيوت\s*السيارات|بطاريات|مغسلة\s*سيارات|parking|مواقف|car|automated\s*parking"),
    ("أزياء وتجميل", r"تجميل|كوافير|كوفيرة|صالون|مكياج|عطور|ملابس|عباءات|رجالية|نسائية|حلاقة|barber|beauty|clothes|leather"),
    ("تقنية ومكاتب", r"كمبيوتر|جوال|هاتف|اتصال|معلومات|أحبار|حبر|طابعات|تقنية|وثائق|computer|call\s*center|online|virtual\s*mall"),
    ("إنشاءات وعقار", r"مقاول|خرسانة|أسقف|إنشاء|حجر\s*البناء|رخام|مباني|عقاري|مجمع|فلل|building|real\s*estate|asphalt"),
    ("تأجير", r"تأجير|leasing|rental"),
    ("ترفيه", r"ألعاب|ترفيه|حديقة|مائية|غوص|diving|amusement|water\s*park"),
]

# عناوين الملفات الإنجليزية التي تحتاج ترجمة مباشرة حتى لا يظهر أي نص
# لاتيني للعميل. الملفات غير الموجودة هنا تمر عبر قاموس الكلمات المختصر أدناه
# ثم تحصل على عنوان عربي عام مناسب للتصنيف.
ENGLISH_TITLE_OVERRIDES = {
    "barbershops ship": "صالون حلاقة متنقل",
    "caffe feasibility study": "دراسة جدوى مقهى",
    "feasibility study for fast food2020": "دراسة جدوى مطعم وجبات سريعة",
    "feasibility study pancake corner": "دراسة جدوى محل بان كيك",
    "filipino traditional delicacie": "مأكولات فلبينية تقليدية",
    "pre feasibility study of flavo lechon roasted chicken": "دراسة جدوى مبدئية لمشروع دجاج مشوي",
    "quick service restaurant in chengdu china": "مطعم وجبات سريعة في تشنغدو بالصين",
    "syrups": "إنتاج الشراب المركز",
    "a feasibility study for developing a computerized adaptive form of raven s colored progressive matrices test for omani children based on the item response theory": "دراسة جدوى لتطوير اختبار حاسوبي متكيف للأطفال العمانيين",
    "hotel feasibility study hotel conference 3 12": "دراسة جدوى فندق وقاعة مؤتمرات",
    "hotel": "فندق",
    "sds study": "دراسة خدمات متنوعة",
    "summary studyfindings211": "ملخص نتائج الدراسة",
    "3 chapter 2": "الفصل الثاني من دراسة الجدوى",
    "51 c2 4": "دراسة جدوى - الفصل الثاني",
    "a childrens museum": "متحف أطفال",
    "a diving center in aqaba": "مركز غوص في العقبة",
    "a private hospital balqa": "مستشفى خاص في البلقاء",
    "a private hospital zarqa": "مستشفى خاص في الزرقاء",
    "a private school zarqa": "مدرسة خاصة في الزرقاء",
    "a tourist village project zarqa": "مشروع قرية سياحية في الزرقاء",
    "agricultural services company madaba": "شركة خدمات زراعية في مادبا",
    "ajloun resort": "منتجع عجلون",
    "al shoula tourism project study": "دراسة مشروع الشولة السياحي",
    "alfalfa forage crop": "زراعة وإنتاج علف البرسيم",
    "almazar irbid": "المزار - إربد",
    "alsharq": "الشرق",
    "amusement park in karak": "مدينة ألعاب ترفيهية في الكرك",
    "an integrated maintenance amman": "شركة صيانة متكاملة في عمّان",
    "an olive oil filling plant": "مصنع تعبئة زيت الزيتون",
    "aromatic final": "مشروع العطور",
    "asphalt recycling plant": "مصنع إعادة تدوير الإسفلت",
    "auto parking": "مواقف سيارات آلية",
    "automoatic bricks factory english version": "مصنع طوب آلي",
    "azraq therapeutic tourism project study": "دراسة مشروع السياحة العلاجية في الأزرق",
    "bac303": "دراسة جدوى رقم 303",
    "basalt ore extraction": "استخراج خامات البازلت",
    "blood transfusion bags plant amman": "مصنع أكياس نقل الدم في عمّان",
    "building stone project": "مشروع استخراج حجر البناء",
    "business complex project in irbid": "مجمع أعمال في إربد",
    "call center": "مركز اتصال",
    "calves fattening project balqa": "مشروع تسمين عجول في البلقاء",
    "chalets final": "شاليهات سياحية",
    "chili cultivation project": "مشروع زراعة الفلفل الحار",
    "claims management amman": "إدارة مطالبات في عمّان",
    "dairy products factory": "مصنع منتجات الألبان",
    "dates grading and packing center": "مركز تدريج وتعبئة التمور",
    "dermatology hospital spa balqa": "مستشفى جلدية ومنتجع علاجي في البلقاء",
    "dolomites factory": "مصنع الدولوميت",
    "download": "ملف دراسة جاهز",
    "dried tomatoes": "تجفيف الطماطم",
    "economic feasibility of development projects arabic": "الجدوى الاقتصادية لمشروعات التنمية",
    "establishing a mall in mafrac": "إنشاء مركز تسوق في المفرق",
    "feasibility study guidelines ar": "إرشادات إعداد دراسة الجدوى",
    "fruits and vegetables grading center": "مركز تدريج وتعبئة الخضروات والفواكه",
    "gemstones factory tafilah": "مصنع الأحجار الكريمة في الطفيلة",
    "glass factory": "مصنع الزجاج",
    "granite extraction plant": "مصنع استخراج الجرانيت",
    "gypsum factory": "مصنع الجبس",
    "hashmeyeh": "الهاشمية",
    "heritage traditional market": "سوق تراثي تقليدي",
    "inflamable coal production plant madaba": "مصنع إنتاج الفحم في مادبا",
    "iv fluids": "مصنع المحاليل الوريدية",
    "juice plant": "مصنع العصائر",
    "karak": "الكرك",
    "leather clothes plant": "مصنع الملابس الجلدية",
    "maan 3 stars hotel": "فندق ثلاث نجوم في معان",
    "manufacturing of bentonite ore": "تصنيع خام البنتونايت",
    "manufacturing of glucose": "تصنيع الجلوكوز",
    "manufacturing of pickles": "تصنيع المخللات",
    "marble factory": "مصنع الرخام",
    "medical olive oil soap factory": "مصنع صابون زيت الزيتون الطبي",
    "medicinal herbs plant": "مصنع تعبئة الأعشاب الطبية",
    "menya": "المنيا",
    "milk collection and marketing center": "مركز تجميع وتسويق حليب الأغنام",
    "molding and metal manufacturing": "قولبة وتصنيع المعادن",
    "mpdf": "دراسة جدوى",
    "multi purposes hall": "قاعة متعددة الأغراض",
    "online virtual mall project amman": "مركز تسوق افتراضي في عمّان",
    "organic fertilizer factory": "مصنع الأسمدة العضوية",
    "pdf": "دراسة جدوى",
    "permanent logistics center amman": "مركز لوجستي دائم في عمّان",
    "pet plastic containers factory": "مصنع عبوات بلاستيكية",
    "polystyrene panels": "ألواح البوليسترين",
    "poultry feed factory": "مصنع أعلاف الدواجن",
    "private school": "مدرسة خاصة",
    "privet hospital maan": "مستشفى خاص في معان",
    "production jameed": "إنتاج الجميد",
    "residental villas in ajloun": "فلل سكنية في عجلون",
    "rural tourist villas project madaba": "مشروع فلل سياحية ريفية في مادبا",
    "seabream fish farm": "مزرعة أسماك دنيس",
    "soilless cultivation project zarqa": "مشروع الزراعة بدون تربة في الزرقاء",
    "sumac cultivation and production project": "مشروع زراعة وإنتاج السماق",
    "szv2nltsmgyht7t5 hcgmvndpvka6pr": "دراسة جدوى رقم ٦",
    "tabaqet fahel": "مشروع طبقة فحل",
    "tafilah resort": "منتجع الطفيلة",
    "thyme cultivation project": "مشروع زراعة الزعتر",
    "tire re treading plant": "مصنع إعادة تجديد الإطارات",
    "touristic traditional market balqa": "سوق تقليدي سياحي في البلقاء",
    "training institute": "معهد تدريب",
    "upvc pipes factory": "مصنع أنابيب بلاستيكية",
    "volcaninc tuff": "خامات الطف البركاني",
    "water park aqaba": "مدينة ألعاب مائية في العقبة",
    "water park jerash": "مدينة ألعاب مائية في جرش",
    "wholesale vegetable and fruit market": "سوق جملة للخضروات والفواكه",
    "zarqa industrial zone study": "دراسة المنطقة الصناعية في الزرقاء",
    "zarqa": "الزرقاء",
    "zeolite manufacturing plant": "مصنع تصنيع الزيولايت",
    "automated car parking system": "نظام مواقف سيارات آلي",
    "cage farming business": "مشروع الاستزراع في الأقفاص",
    "rail railways": "دراسة جدوى السكك الحديدية",
    "reports and documents 2052021000 eg financial services crr booklet": "كتيب التقارير والوثائق للخدمات المالية",
    "rocky mountain rail authority rail feasibility study": "دراسة جدوى هيئة سكك روكي ماونتن",
    "startup evolution curve excerpt 2017 05 31": "منحنى تطور الشركات الناشئة",
}

ENGLISH_WORDS = {
    "feasibility": "جدوى", "study": "دراسة", "project": "مشروع", "factory": "مصنع", "plant": "مصنع",
    "hotel": "فندق", "restaurant": "مطعم", "cafe": "مقهى", "caffe": "مقهى", "coffee": "قهوة",
    "food": "غذاء", "fast": "سريعة", "service": "خدمات", "services": "خدمات", "center": "مركز",
    "centre": "مركز", "market": "سوق", "mall": "مركز تسوق", "hospital": "مستشفى", "school": "مدرسة",
    "tourist": "سياحي", "tourism": "سياحة", "resort": "منتجع", "factory": "مصنع", "manufacturing": "تصنيع",
    "production": "إنتاج", "cultivation": "زراعة", "agricultural": "زراعي", "farming": "زراعة",
    "fish": "أسماك", "poultry": "دواجن", "vegetable": "خضروات", "vegetables": "خضروات", "fruit": "فواكه",
    "fruits": "فواكه", "plastic": "بلاستيك", "pipes": "أنابيب", "water": "مياه", "park": "حديقة",
    "training": "تدريب", "institute": "معهد", "center": "مركز", "call": "اتصال", "parking": "مواقف",
    "automatic": "آلي", "automated": "آلي", "business": "مشروع", "company": "شركة", "final": "نهائي",
}


ARABIC_PDF_RUN = re.compile(r"[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+")
REVERSED_ARABIC_MARKERS = (
    "\u0645\u0633\u0627",  # مسا ← اسم
    "\u0639\u0648\u0631\u0634",  # بداية كلمة المشروع المعكوسة
    "\u0629\u0631\u0643\u0641",  # الفكرة
    "\u0635\u0626\u0627\u0635\u062e",  # خصائص
    "\u062a\u0627\u062c\u0631\u062e",  # مخرجات
    "\u0629\u0639\u0641\u0646\u0644\u0645",  # المنفعة
)


def normalize_pdf_arabic(value: str) -> str:
    """Normalize Arabic glyph forms and repair PDF text with reversed runs."""
    if not value:
        return ""

    normalized = unicodedata.normalize("NFKC", value)
    reversed_marker_hits = sum(marker in normalized for marker in REVERSED_ARABIC_MARKERS)
    if reversed_marker_hits < 2:
        return normalized

    # Some PDF encoders return each Arabic word backwards using presentation
    # glyphs. Reverse each Arabic run before NFKC so ligatures expand correctly.
    repaired = ARABIC_PDF_RUN.sub(
        lambda match: unicodedata.normalize("NFKC", match.group(0)[::-1]),
        value,
    )
    return unicodedata.normalize("NFKC", repaired)


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.replace("ـ", " ").replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    return re.sub(r"\s+", " ", value).strip().lower()


def latin_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def remove_latin_fragments(value: str) -> str:
    cleaned = re.sub(r"[A-Za-z][A-Za-z0-9._-]*", " ", value or "")
    return re.sub(r"\s+", " ", cleaned).strip(" -_.")


def arabic_title(path: Path, filename_title: str, category_label: str) -> str:
    if not re.search(r"[A-Za-z]", filename_title):
        return filename_title

    key = latin_key(path.stem)
    if key in ENGLISH_TITLE_OVERRIDES:
        return ENGLISH_TITLE_OVERRIDES[key]
    if "food truck" in key:
        return "عربة طعام متنقلة"
    if "machro3" in key:
        return "دراسة جدوى لمشروع مغسلة سيارات متنقلة"

    # في أسماء الملفات المختلطة نحتفظ بالجزء العربي ونحذف النطاقات أو
    # الاختصارات اللاتينية غير المفيدة للعميل.
    arabic_part = remove_latin_fragments(filename_title)
    if len(re.sub(r"[\d\s-]", "", arabic_part)) >= 4:
        return arabic_part

    tokens = re.findall(r"[a-z0-9]+", key)
    translated = [ENGLISH_WORDS[token] for token in tokens if token in ENGLISH_WORDS]
    if translated:
        return " ".join(translated)
    return f"دراسة جدوى لمشروع {category_label}"


def arabic_excerpt(excerpt: str, category_label: str) -> str:
    # بعض ملفات PDF تحتوي على نص لاتيني أو بريد إلكتروني في الصفحة الأولى؛
    # نستبدله بوصف عربي ثابت حتى لا يتسرب أي نص إنجليزي إلى البطاقة. نفس
    # المعيار (is_junk_excerpt) يغطي حالة نادرة: كل الصفحات الممسوحة في
    # extract_first_page غير صالحة (قالب غلاف فارغ عبر عدة صفحات متتالية).
    if not excerpt or re.search(r"[A-Za-z]", excerpt) or is_junk_excerpt(excerpt):
        return f"دراسة جدوى جاهزة ضمن تصنيف {category_label}."
    return excerpt


def clean_excerpt(value: str, limit: int = 220) -> str:
    value = re.sub(r"\s+", " ", (value or "")).strip()
    return value[:limit].rstrip() + ("…" if len(value) > limit else "")


def readable_filename(path: Path) -> str:
    raw = path.stem.replace("_", " ").replace("-", " ")
    raw = re.sub(r"\s+", " ", raw).strip()
    if re.fullmatch(r"[\d\s]+", raw or ""):
        return f"دراسة جدوى رقم {raw.strip()}"
    return raw or "دراسة جدوى جاهزة"


def derive_numeric_title(filename_title: str, excerpt: str) -> str:
    if not filename_title.startswith("دراسة جدوى رقم ") or not excerpt:
        return filename_title
    compact = normalize_text(excerpt)
    patterns = [
        r"(?:لمشروع|مشروع)\s+(.{4,90}?)(?:\s{2,}|فكرة المشروع|نبذة|الهدف|$)",
        r"دراسة جدوى\s+(?:لمشروع\s+)?(.{4,90}?)(?:\s{2,}|فكرة|نبذة|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, compact)
        if match:
            candidate = re.sub(r"\s+", " ", match.group(1)).strip(" .:،")
            if 4 <= len(candidate) <= 90:
                return f"دراسة جدوى لمشروع {candidate}"
    return filename_title


# تدقيق 2026-08-27: extract_first_page كانت تكتفي بالصفحة الأولى دوماً — 12 من
# 14 نبذة "مهملة" رُصدت لاحقاً مصدرها قالب واحد شائع (عدة دراسات من "مكتب
# ابتكار القيمة للاستشارات"، مثال: web/__tests__/readyStudiesCatalog.
# excerptSkipsJunkCoverPage.test.js) صفحته الأولى غلاف شبه فارغ نصّه الكامل
# "رقم الدراسة" — المحتوى الفعلي (عنوان المشروع، خطاب تنبيه المكتب) يبدأ من
# الصفحة الثانية. النتيجة كانت نبذة بلا أي معنى تُعرض حرفياً على بطاقة العميل.
EXCERPT_MIN_LENGTH = 25
JUNK_EXCERPT_RES = (
    re.compile(r"^رقم\s+الدراسة$"),
    re.compile(r"^[٠-٩0-9\s]+$"),
)


def is_junk_excerpt(text: str) -> bool:
    stripped = (text or "").strip()
    if len(stripped) < EXCERPT_MIN_LENGTH:
        return True
    return any(pattern.match(stripped) for pattern in JUNK_EXCERPT_RES)


def extract_first_page(path: Path, page_scan_limit: int = 4) -> tuple[str, int]:
    if path.suffix.lower() != ".pdf":
        return "", 0
    if PdfReader is None:
        return "", 0
    try:
        reader = PdfReader(str(path), strict=False)
        page_count = len(reader.pages)
        fallback = ""
        for page in reader.pages[:page_scan_limit]:
            try:
                candidate = clean_excerpt(normalize_pdf_arabic(page.extract_text() or ""))
            except Exception:
                continue
            if not fallback:
                fallback = candidate
            if not is_junk_excerpt(candidate):
                return candidate, page_count
        # كل الصفحات الممسوحة غير صالحة (نادر) — نُعيد أفضل ما وُجد بدل سلسلة
        # فارغة؛ arabic_excerpt/الفهرس يسقط لاحقاً إلى نص التصنيف النائب.
        return fallback, page_count
    except Exception:
        return "", 0


# تدقيق 2026-08-27: كل الدراسات الـ301 كانت تحمل country="SA" يدوياً بلا
# استثناء (كوميت aa96ff1) رغم أن نص عشرات الملفات المصدرية يذكر صراحة مؤشرات
# مالية/جغرافية أردنية أو مصرية. detect_country() تفحص أول 15 صفحة بحثاً عن
# عملة (دينار/جنيه) أو اسم دولة/محافظة صريح، فتمنع تكرار نفس الادعاء الكاذب
# عند أي إعادة توليد مستقبلية للفهرس. راجع web/__tests__/readyStudiesCatalog.countryMatchesSourceText.test.js
# للأدلة النصية الكاملة وراء كل تصحيح.
COUNTRY_DETECTION_PAGE_LIMIT = 15
COUNTRY_CONFIDENCE_MIN = 2
COUNTRY_DOMINANCE_RATIO = 3.0

# قرار متعمد ومقبول (2026-08-27، بعد اكتشاف حالتي pdf.pdf/محلات تجارية.pdf
# العراقيتين): "دينار" وحدها ليست حصرية للأردن — يشاركها العراق والكويت
# والبحرين وتونس والجزائر وليبيا، فقد تصنَّف دراسة من أحد هذه الدول "JO" رغم
# غياب أي مدينة/دولة أردنية فعلية (jo_total يعبر COUNTRY_CONFIDENCE_MIN من
# العملة وحدها). لم يُبنَ كاشف دول إضافي (IQ/KW/BH/TN/DZ/LY) لأن الفهرس
# الحالي (300 دراسة) لا يحوي إلا حالتين من هذا النوع، وكلاهما تم التحقق منه
# يدوياً وتصحيحه عبر COUNTRY_OVERRIDES أعلاه — آلية موجودة أصلاً لهذا الغرض
# بالضبط. عند أي إعادة توليد مستقبلية تضيف ملفات جديدة، افحص يدوياً أي دراسة
# جديدة تُصنَّف "JO" اعتماداً على العملة فقط (بلا مدينة/اسم دولة مرافق) قبل
# الوثوق بها.
JO_CURRENCY_RE = re.compile(r"دينار|دنانير")
JO_COMPOUND_NAME_RE = re.compile(r"المملكة\s+الأردنية|المملكة\s+الاردنية")
JO_BARE_NAME_RE = re.compile(r"الأردن\b|الاردن\b|\bJordan\b", re.IGNORECASE)
# ملاحظة: "عمّان/عمان" استُبعدت عمداً — كثيراً ما تعني "سلطنة عُمان" لا
# العاصمة الأردنية، وكل حالة أردنية حقيقية رصدناها مدعومة بأدلة أخرى أصلاً.
JO_CITY_RE = re.compile(
    r"\b(?:الزرقاء|إربد|اربد|السلط|مادبا|الكرك|معان|الطفيلة|عجلون|جرش|"
    r"العقبة|المفرق|البلقاء|الرصيفة|الأزرق|الازرق|الرمثا|ذيبان)\b"
)

EG_CURRENCY_RE = re.compile(r"جنيه")
EG_COMPOUND_NAME_RE = re.compile(r"جمهورية\s+مصر|مصر\s+العربية")
EG_BARE_NAME_RE = re.compile(r"\bEgypt\b", re.IGNORECASE)
# ملاحظة: "الغربية/الشرقية" استُبعدتا — صفتان عامتان (غربي/شرقي) قبل أن
# تكونا محافظتين مصريتين، وكلمة "مصر" المجرّدة استُبعدت من الاحتساب لأنها
# غالباً سياق عابر (استيراد/خلفية تاريخية) لا يدل على موقع المشروع الفعلي.
EG_CITY_RE = re.compile(
    r"\b(?:القاهرة|الإسكندرية|الاسكندرية|الجيزة|المنصورة|الدقهلية|أسيوط|اسيوط|"
    r"بورسعيد|الإسماعيلية|الاسماعيلية|دمياط|سوهاج|أسوان|اسوان|الفيوم|"
    r"بني\s*سويف|المنيا|كفر\s*الشيخ|طنطا|الزقازيق|دمنهور|شبين\s*الكوم)\b"
)

# 4 دراسات تجاوز دليلها نافذة الـ15 صفحة القياسية أو اعتمد على صياغة لا يمكن
# تعميمها بأمان كقاعدة عامة (كلمة "مصر" المجرّدة وحدها مصدر إنذارات كاذبة في
# معظم الدراسات الأخرى) — صُنِّفت يدوياً بعد قراءة كامل الملف:
COUNTRY_OVERRIDES = {
    # "خطـوات تأسـيس مشـروع مركـز الخـدمات الطلابيـة فـ مصر" — تصريح مباشر
    # بأن المشروع نفسه في مصر.
    "40e9c2a12b16": "EG",  # mpdf.pdf
    # "جنيه مصري" صريحة ضمن حساب أرباح المشروع؛ لا ذكر لكلمة "ريال" إطلاقاً
    # في كامل الملف (10 صفحات).
    "57ac8e6be45f": "EG",  # مغسلة السيارات.pdf
    # "من أهم المزايا التي ترجح هذا المشروع في مصر: توفر المواد الخام في
    # مصر" — تكرر 4 مرات كمبرر مباشر لموقع المشروع.
    "5ecbd1f29531": "EG",  # تصنيع الآيس كريم.pdf
    # كلمة "مصر" تتكرر 31 مرة عبر كامل الملف (26 صفحة) في قسم مواصفات وحجم
    # سوق المياه المعدنية — أبعد من نافذة الـ15 صفحة القياسية.
    "cf4974f602fe": "EG",  # مصنع انتاج میاه معدنیة.pdf
    # تصحيح 2026-08-27 (اكتُشف أثناء عمل لاحق): detect_country صنّفتها "JO"
    # تلقائياً لأن "دينار" وحدها (بلا اسم مدينة/دولة أردنية مرافق) عملة مشتركة
    # بين الأردن والعراق (والكويت والبحرين وتونس والجزائر وليبيا) — إشارة غير
    # حاسمة انفرادياً. المحتوى الفعلي هنا لا لبس فيه: "محافظة المثنى"،
    # "مدينة السماوة"، "جامعة المثنى"، وفي pdf.pdf تحديداً "قانون الاستثمار
    # العراقي رقم 13 لسنة 2006" — دراستان عراقيتان لنفس المؤلف الأكاديمي.
    "4c157def8d0b": "IQ",  # pdf.pdf — عمارة تجارية سكنية في مدينة السماوة، العراق
    "49ed45450eaa": "IQ",  # محلات تجارية .pdf — محلات تجارية في محافظة المثنى، العراق
}

# تدقيق 2026-08-27: عناوين مشتقة آلياً من اسم ملف تقني بلا معنى (mpdf.pdf،
# pdf.pdf) أو من ملف حرفياً اسمه "دراسة جدوى.pdf" — تنتج عنواناً عاماً
# "دراسة جدوى" بلا أي دلالة على موضوع الدراسة رغم توفر محتوى فعلي يكشفه.
# عناوين مصحَّحة يدوياً من قراءة أول صفحتين من كل ملف مصدري.
TITLE_OVERRIDES = {
    # المحتوى: "خطوات تأسيس مشروع مركز الخدمات الطلابية فـ مصر".
    "40e9c2a12b16": "دراسة جدوى لمشروع مركز خدمات طلابية متكامل",
    # المحتوى (عراقي — انظر COUNTRY_OVERRIDES أعلاه): "دراسة جدوى مشروع إنشاء
    # عمارة تجارية سكنية في مدينة السماوة" — جامعة المثنى، 2010.
    "4c157def8d0b": "دراسة جدوى لمشروع إنشاء عمارة تجارية سكنية",
    # المحتوى: دليل عام لإعداد دراسات الجدوى للمشاريع الصغيرة، من دائرة
    # التنمية الاقتصادية في رأس الخيمة (rak.ae) — ليس دراسة لمشروع محدد، بل
    # كتيّب منهجية. العنوان يعكس طبيعته الفعلية بدل الإيحاء بدراسة مشروع.
    "87e372350e23": "دليل إعداد دراسات الجدوى الاقتصادية للمشاريع الصغيرة",
    # اسم الملف المصدري نفسه تالف جزئياً ("ة كوفي شوب ب.pdf") — المحتوى
    # الفعلي (صفحة 2، بعد غلاف شبه فارغ): "دراسة جدوى اقتصادية-مقهى مكة".
    "df6a2ece59eb": "دراسة جدوى لمشروع مقهى في مكة المكرمة",
}


def detect_country(text: str) -> str:
    """يفحص نص أول صفحات الملف بحثاً عن مؤشرات مالية/جغرافية أردنية أو مصرية
    واضحة (عملة أو اسم محافظة/دولة). يستخدم اختباراً بمعدل هيمنة (3×) كي لا
    يفرض ذِكر عابر واحد للدولة الأخرى (كجدول مقارنة إقليمي) تصنيفاً متضارباً.
    يعيد "SA" افتراضياً حين لا يظهر أي مؤشر واضح — لا نغيّر الافتراض إلا بدليل.
    """
    jo_total = (
        3 * len(JO_CURRENCY_RE.findall(text))
        + 3 * len(JO_COMPOUND_NAME_RE.findall(text))
        + len(JO_BARE_NAME_RE.findall(text))
        + 2 * len(set(JO_CITY_RE.findall(text)))
    )
    eg_total = (
        3 * len(EG_CURRENCY_RE.findall(text))
        + 3 * len(EG_COMPOUND_NAME_RE.findall(text))
        + len(EG_BARE_NAME_RE.findall(text))
        + 2 * len(set(EG_CITY_RE.findall(text)))
    )

    if jo_total >= COUNTRY_CONFIDENCE_MIN and eg_total == 0:
        return "JO"
    if eg_total >= COUNTRY_CONFIDENCE_MIN and jo_total == 0:
        return "EG"
    if jo_total > 0 and eg_total > 0:
        if jo_total >= COUNTRY_DOMINANCE_RATIO * eg_total and jo_total >= COUNTRY_CONFIDENCE_MIN:
            return "JO"
        if eg_total >= COUNTRY_DOMINANCE_RATIO * jo_total and eg_total >= COUNTRY_CONFIDENCE_MIN:
            return "EG"
    return "SA"


def extract_country(path: Path, record_id: str, page_limit: int = COUNTRY_DETECTION_PAGE_LIMIT) -> str:
    if record_id in COUNTRY_OVERRIDES:
        return COUNTRY_OVERRIDES[record_id]
    if path.suffix.lower() != ".pdf" or PdfReader is None:
        return "SA"
    try:
        reader = PdfReader(str(path), strict=False)
        parts = []
        for page in reader.pages[:page_limit]:
            try:
                parts.append(normalize_pdf_arabic(page.extract_text() or ""))
            except Exception:
                continue
        return detect_country("\n".join(parts))
    except Exception:
        return "SA"


def language_for(name_and_excerpt: str) -> str:
    has_arabic = bool(re.search(r"[\u0600-\u06ff]", name_and_excerpt))
    has_latin = bool(re.search(r"[A-Za-z]", name_and_excerpt))
    if has_arabic and has_latin:
        return "mixed"
    if has_arabic:
        return "ar"
    if has_latin:
        return "en"
    return "unknown"


def make_tags(category_folder: str, filename: str, excerpt: str, page_count: int) -> list[str]:
    filename_stem = Path(filename).stem
    # Most files have a descriptive filename.  Academic front matter often
    # mentions unrelated words such as "school" or "health", so use the
    # extracted page only for numeric/opaque filenames where it is needed to
    # identify the actual project.
    is_opaque = bool(re.fullmatch(r"[\d\s]+", filename_stem or "")) or len(filename_stem) <= 3
    combined = normalize_text(f"{filename} {excerpt if is_opaque else ''}")
    tags: list[str] = []
    category_id = CATEGORY_META[category_folder][0]
    category_tag = {
        "food": "أطعمة ومشروبات",
        "retail-services": "تجارة وخدمات",
        "mens": "أزياء رجالية",
        "leasing": "تأجير",
        "misc": "مشروعات متنوعة",
        "education": "تعليم وتدريب",
        "automotive": "سيارات ونقل",
        "students": "خدمات طلابية",
        "kiosk": "مشاريع صغيرة",
        "manufacturing-agriculture": "مشروعات إنتاجية",
        "construction": "مقاولات وإنشاءات",
        "women": "أزياء وتجميل",
    }[category_id]
    tags.append(category_tag)
    for tag, pattern in TAG_RULES:
        if re.search(pattern, combined, flags=re.IGNORECASE):
            tags.append(tag)

    if re.search(r"ملخص|summary|مختصر", combined, flags=re.IGNORECASE):
        tags.append("ملخص إرشادي")
    if re.search(r"نموذج|إرشاد|guideline|chapter|research paper|primer", combined, flags=re.IGNORECASE):
        tags.append("نموذج أو مادة إرشادية")
    if re.search(r"pre[- ]?feasibility|مبدئية|اولية|أولية", combined, flags=re.IGNORECASE):
        tags.append("دراسة مبدئية")
    if page_count >= 25 or len(excerpt) >= 180:
        tags.append("دراسة موسعة")
    elif page_count and page_count <= 10:
        tags.append("دراسة مختصرة")
    if language_for(combined) == "en":
        tags.append("بالإنجليزية")
    elif language_for(combined) == "mixed":
        tags.append("عربي وإنجليزي")
    if re.fullmatch(r"[\d\s]+", filename_stem or ""):
        tags.append("اسم ملف غير وصفي")

    deduped: list[str] = []
    for tag in tags:
        if tag not in deduped:
            deduped.append(tag)
    return deduped[:7]


def size_label(size: int) -> str:
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} ميجابايت"
    return f"{max(1, round(size / 1024))} كيلوبايت"


def build_catalog() -> dict:
    if not SOURCE_ROOT.is_dir():
        raise FileNotFoundError(f"لم يُعثر على مجلد الدراسات: {SOURCE_ROOT}")

    studies = []
    category_counts: Counter[str] = Counter()
    tag_counts: Counter[str] = Counter()

    for path in sorted(SOURCE_ROOT.rglob("*.pdf"), key=lambda item: str(item).casefold()):
        if not path.is_file():
            continue
        try:
            relative_parts = path.relative_to(SOURCE_ROOT)
            folder = relative_parts.parts[0]
        except ValueError:
            continue
        if folder not in CATEGORY_META:
            continue
        if relative_parts.as_posix() in SKIP_FILES:
            continue
        category_id, category_label, category_description = CATEGORY_META[folder]
        relative = path.relative_to(SOURCE_ROOT).as_posix()
        record_id = hashlib.sha1(relative.encode("utf-8")).hexdigest()[:12]
        excerpt, page_count = extract_first_page(path)
        if record_id in TITLE_OVERRIDES:
            title = TITLE_OVERRIDES[record_id]
        else:
            filename_title = readable_filename(path)
            title = derive_numeric_title(filename_title, excerpt)
            title = arabic_title(path, title, category_label)
        display_excerpt = arabic_excerpt(excerpt, category_label)
        encoded_url = "/studies/" + "/".join(quote(part, safe="") for part in relative.split("/"))
        content_for_tags = f"{path.name} {excerpt}"
        tags = make_tags(folder, path.name, content_for_tags, page_count)
        language = language_for(content_for_tags)
        record = {
            "id": record_id,
            "title": title,
            "filename": path.name,
            "category": category_id,
            "categoryLabel": category_label,
            "categoryDescription": category_description,
            "tags": tags,
            "url": encoded_url,
            "format": "ملف",
            "downloadName": f"{title}.pdf",
            "size": path.stat().st_size,
            "sizeLabel": size_label(path.stat().st_size),
            "pages": page_count,
            "language": language,
            "excerpt": display_excerpt,
            "country": extract_country(path, record_id),
        }
        studies.append(record)
        category_counts[category_id] += 1
        tag_counts.update(tags)

    categories = []
    for folder, (category_id, label, description) in CATEGORY_META.items():
        if category_counts[category_id]:
            categories.append({
                "id": category_id,
                "label": label,
                "folder": folder,
                "description": description,
                "count": category_counts[category_id],
            })

    return {
        "version": 1,
        "generatedAt": date.today().isoformat(),
        "sourceFolder": SOURCE_ROOT.name,
        "total": len(studies),
        "categories": categories,
        "tags": [{"label": label, "count": count} for label, count in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))],
        "studies": studies,
    }


def main() -> int:
    try:
        catalog = build_catalog()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {catalog['total']} study records at {OUTPUT}")
    for category in catalog["categories"]:
        print(f"- {category['label']}: {category['count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
