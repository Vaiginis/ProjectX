#!/usr/bin/env python3
"""Generate site/b/index.html from site/index.html.

Variant B is a pure re-skin: identical markup, identical flow logic, identical
copy. The entire difference between A and B is site/b/theme.css, which loads
after site/styles.css and repaints the system.

Keeping B generated (rather than hand-copied) means the two variants can never
drift in content, so an A/B result is attributable to design alone.

    python3 tools/build-variant-b.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "site" / "index.html"
OUT = ROOT / "site" / "b" / "index.html"

FONTS_A = re.compile(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">')
FONTS_B = (
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
    'family=Nunito:wght@400;500;600;700;800;900&'
    'family=Inter:wght@700;800;900&display=swap">'
)

BANNER = (
    "<!-- GENERATED FILE — do not edit.\n"
    "     Built from site/index.html by tools/build-variant-b.py.\n"
    "     Variant B differs from A only in site/b/theme.css. -->\n"
)


def build(html: str) -> str:
    # every relative reference now sits one directory deeper
    html = html.replace('src="assets/', 'src="../assets/')
    html = html.replace('href="assets/', 'href="../assets/')
    html = html.replace('src="app.js"', 'src="../app.js"')

    # swap the typefaces, then layer the theme over the base stylesheet
    html = FONTS_A.sub(FONTS_B, html, count=1)
    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        '<link rel="stylesheet" href="../styles.css">\n'
        '<link rel="stylesheet" href="theme.css">',
        1,
    )

    html = html.replace(
        "<title>Idea X — quiz funnel prototype</title>",
        "<title>Idea X — quiz funnel (variant B)</title>",
        1,
    )
    # lets analytics split A from B without a separate property
    html = html.replace('<html lang="en">', '<html lang="en" data-variant="b">', 1)
    return BANNER + html


def main() -> int:
    html = SRC.read_text(encoding="utf-8")
    out = build(html)

    for needle in ('href="../styles.css"', 'href="theme.css"', 'src="../app.js"',
                   'src="../assets/', 'data-variant="b"', "Nunito"):
        if needle not in out:
            print(f"build failed: {needle!r} missing from output", file=sys.stderr)
            return 1
    if 'href="styles.css"' in out or 'src="assets/' in out:
        print("build failed: an un-rewritten relative path survived", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(out):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
