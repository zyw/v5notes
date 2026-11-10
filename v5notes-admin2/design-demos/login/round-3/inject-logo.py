#!/usr/bin/env python3
"""Replace __LOGO_DATA_URI__ placeholder in an HTML file with the real logo data URI."""
import sys
from pathlib import Path

base = Path(__file__).resolve().parent
uri = (base / "assets" / "logo-datauri.txt").read_text().strip()

for arg in sys.argv[1:]:
    p = Path(arg).resolve()
    html = p.read_text()
    if "__LOGO_DATA_URI__" not in html:
        print(p.name + ": no placeholder (already injected?)")
        continue
    p.write_text(html.replace("__LOGO_DATA_URI__", uri))
    print(p.name + ": logo injected, " + str(p.stat().st_size // 1024) + " KB")
