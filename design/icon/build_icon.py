#!/usr/bin/env python3
"""
The shipping icon for shopify-multistore-mcp: the tag ring.

Three store tags hang from one ring, each with its own shop on its face: several stores held
together and carried as one. The geometry and material live as named constants in
options/build_options.py (tagring() and tagring_small()); this script writes the two masters
here and exports every raster the repo and the marketing page use.

  icon.svg          the layered master, used at 96px and above
  icon-small.svg    the same idea drawn for a 16px grid: heavier ring, no holes or symbols,
                    a light seam between the tags. Used below 96px.

Usage: python3 build_icon.py   (needs rsvg-convert)
"""

import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "options"))
import build_options  # noqa: E402

SMALL_BELOW = 96
SIZES = (1024, 512, 256, 128, 64, 32, 16)
MARKETING = HERE.parent / "marketing" / "assets"


def png(svg: pathlib.Path, size: int, out: pathlib.Path):
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(svg), "-o", str(out)], check=True)


def pick(size: int) -> pathlib.Path:
    return HERE / ("icon-small.svg" if size < SMALL_BELOW else "icon.svg")


def main():
    (HERE / "icon.svg").write_text(build_options.tagring())
    (HERE / "icon-small.svg").write_text(build_options.tagring_small())
    export = HERE / "export"
    export.mkdir(exist_ok=True)
    for s in SIZES:
        png(pick(s), s, export / f"icon-{s}.png")
    png(pick(16), 16, export / "favicon-16.png")
    png(pick(32), 32, export / "favicon-32.png")
    png(HERE / "icon.svg", 180, export / "apple-touch-icon.png")
    shutil.copyfile(HERE / "icon-small.svg", export / "favicon.svg")
    if MARKETING.exists():
        png(HERE / "icon.svg", 96, MARKETING / "icon-96.png")
        for name in ("icon-512.png", "favicon-32.png", "apple-touch-icon.png", "favicon.svg"):
            shutil.copyfile(export / name, MARKETING / name)
    print(f"wrote icon.svg, icon-small.svg and {len(SIZES) + 4} files in {export}")


if __name__ == "__main__":
    main()
