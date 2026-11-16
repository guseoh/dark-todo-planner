"""Builds the small first-paint font subsets from the full variable fonts in fonts-src/.

The full fonts live in fonts-src/ (not deployed). Characters outside the subsets (rare Hangul syllables) fall back
to the next font in the stack. Re-run this when the UI starts using new characters:

    pip install fonttools brotli
    python scripts/subset-fonts.py
"""
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "fonts-src"
FONTS = ROOT / "public" / "fonts"

BASE_RANGES = [
    (0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x2190, 0x21FF), (0x2200, 0x22FF),
    (0x25A0, 0x25FF), (0x2600, 0x26FF), (0x2700, 0x27BF), (0x3000, 0x303F), (0x3130, 0x318F), (0xFF01, 0xFF5E),
]


def codepoints(ranges):
    return {cp for start, end in ranges for cp in range(start, end + 1)}


def ksx1001_hangul():
    """The 2,350 Hangul syllables of KS X 1001, which cover everyday Korean text."""
    found = set()
    for lead in range(0xB0, 0xC9):
        for trail in range(0xA1, 0xFF):
            try:
                found.add(ord(bytes([lead, trail]).decode("euc-kr")))
            except UnicodeDecodeError:
                pass
    return found


def used_in_project():
    """Every non-ASCII character that appears in the app's own sources, so UI text never needs the fallback."""
    chars = set()
    for folder in ("src", "worker", "index.html"):
        path = ROOT / folder
        files = [path] if path.is_file() else [p for p in path.rglob("*") if p.suffix in {".ts", ".tsx", ".css", ".html"}]
        for file in files:
            chars.update(ord(ch) for ch in file.read_text(encoding="utf-8") if ord(ch) > 0x7F)
    return chars


def build(source, target, unicodes):
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.notdef_outline = True
    options.name_IDs = ["*"]
    font = subset.load_font(str(SOURCES / source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(unicodes))
    subsetter.subset(font)
    subset.save_font(font, str(FONTS / target), options)
    print(f"{target}: {(FONTS / target).stat().st_size // 1024} KB")


if __name__ == "__main__":
    korean = codepoints(BASE_RANGES) | ksx1001_hangul() | used_in_project()
    build("PretendardVariable.woff2", "PretendardSubset.woff2", korean)
    build("InterVariable.woff2", "InterSubset.woff2", codepoints(BASE_RANGES) | {c for c in used_in_project() if c < 0x2E80})
