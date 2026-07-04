import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def extract_docx_text(docx_path: Path) -> str:
    with zipfile.ZipFile(docx_path, "r") as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)

    paras = []
    for p in root.findall(".//w:p", NS):
        runs = []
        for t in p.findall(".//w:t", NS):
            if t.text:
                runs.append(t.text)
        txt = "".join(runs).strip()
        if txt:
            paras.append(txt)

    # Normalize spacing
    out = "\n".join(paras)
    out = out.replace("\u00a0", " ")
    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip() + "\n"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python tools/docx_extract_text.py <file.docx> [out.txt]")
        return 2

    src = Path(argv[1])
    dst = Path(argv[2]) if len(argv) > 2 else None
    text = extract_docx_text(src)

    if dst:
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(text, encoding="utf-8", newline="\n")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

