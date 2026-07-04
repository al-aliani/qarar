#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
توليد Pitch Script بالـ AI — من سطر الأوامر أو عبر API المحلي.

الاستخدام:
  python scripts/generate_pitch_script.py
  python scripts/generate_pitch_script.py --json '{"name":"مشروع X","city":"الرياض",...}'
  python scripts/generate_pitch_script.py --file study_export.json
"""
import json
import sys
import urllib.request
import urllib.error

AI_SERVER_URL = "http://localhost:8080/api/generate"


def generate_pitch_local(info: dict) -> str:
    """توليد نص Pitch محلياً بدون خادم (نفس منطق ai_server.py)."""
    name = info.get("name", "المشروع")
    city = info.get("city", "المدينة")
    desc = info.get("description") or "خدمات متميزة"
    concept = info.get("concept") or desc
    sector = info.get("sector") or "القطاع"
    indicators = info.get("indicators") or info.get("kpis") or {}
    npv = indicators.get("npv") or 0
    irr = indicators.get("irr") or 0
    payback = indicators.get("paybackPeriod") or indicators.get("payback") or 0
    roi = indicators.get("roi") or 0

    return f"""سكربت العرض التقديمي (Pitch) — {name}
مدة مقترحة: 1–2 دقيقة

[الافتتاحية — 15 ثانية]
مرحباً، أنا هنا لأقدم لكم فرصة استثمارية واضحة: مشروع «{name}» في {city}. نحن نقدم {desc}، ونستهدف فجوة حقيقية في السوق.

[المشكلة والحل — 25 ثانية]
المشكلة التي نعالجها: عدم وجود عرض يوفّر {concept} بجودة عالية وسعر مناسب في نطاقنا. حلنا يقوم على {concept} مع فريق محترف وموقع استراتيجي في {city}.

[السوق والفرصة — 20 ثانية]
• السوق المستهدف: {city} والمناطق المحيطة.
• القطاع: {sector}.
• لدينا خطة واضحة للوصول إلى العملاء وتحقيق النمو.

[الأرقام الرئيسية — 25 ثانية]
• صافي القيمة الحالية (NPV): {npv:,.0f} ريال.
• معدل العائد الداخلي (IRR): {(irr * 100) if irr else 0:.1f}%.
• فترة الاسترداد: {payback:.1f} سنوات.
• العائد على الاستثمار (ROI): {(roi * 100) if roi else 0:.0f}%.

[الإغلاق — 15 ثانية]
نطلب منكم الشراكة معنا لتحقيق هذه الرؤية. شكراً لكم، وأنا جاهز لأسئلتكم."""


def main():
    info = {}
    if "--file" in sys.argv:
        idx = sys.argv.index("--file")
        path = sys.argv[idx + 1]
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        info = data.get("projectInfo", data)
        if data.get("results", {}).get("indicators"):
            info = {**info, "indicators": data["results"]["indicators"]}
    elif "--json" in sys.argv:
        idx = sys.argv.index("--json")
        raw = sys.argv[idx + 1]
        info = json.loads(raw)
    else:
        # قيم افتراضية للاختبار
        info = {
            "name": "مشروع تجريبي",
            "city": "الرياض",
            "description": "خدمات متميزة للعملاء",
            "concept": "جودة عالية وسعر تنافسي",
            "sector": "القطاع الخدمي",
            "indicators": {"npv": 500000, "irr": 0.22, "paybackPeriod": 3.5, "roi": 0.35},
        }

    # محاولة استدعاء API المحلي أولاً
    try:
        body = json.dumps({"type": "pitch_script", "projectInfo": info}).encode("utf-8")
        req = urllib.request.Request(
            AI_SERVER_URL,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            out = json.loads(resp.read().decode("utf-8"))
            text = out.get("content", "")
            if text:
                print(text)
                return
    except (urllib.error.URLError, OSError, TimeoutError):
        pass

    # Fallback: توليد محلي
    print(generate_pitch_local(info))


if __name__ == "__main__":
    main()
