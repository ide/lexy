#!/usr/bin/env python3
"""Composite the matched PNG layers into flattened renders.

The rounded-square enclosure is applied here at composite time so the preview
renders show the icon as it appears on the Home Screen. Layer artwork itself
stays enclosure-free for Icon Composer, which applies the system mask.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

PROJECT = Path(__file__).resolve().parent.parent
DESIGN = json.loads((PROJECT / 'design.json').read_text())
PNG_DIR = PROJECT / 'png-layers'
RENDER_DIR = PROJECT / 'renders'
SIZE = DESIGN['canvas']['size']

LAYER_ORDER = [
    '00-background-base.png',
    '01-background-vignette.png',
    '02-background-edge.png',
    '03-ring-shadow.png',
    '04-ring-metal.png',
    '05-ring-highlight.png',
    '06-ring-red-bright.png',
    '07-ring-red-dark.png',
    '08-glyph-shadow.png',
    '09-glyph-metal.png',
    '10-glyph-highlight.png',
]


def main() -> None:
    RENDER_DIR.mkdir(exist_ok=True)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 255))
    for name in LAYER_ORDER:
        layer = Image.open(PNG_DIR / name).convert('RGBA')
        canvas = Image.alpha_composite(canvas, layer)
    canvas = apply_enclosure(canvas)
    flattened = canvas.convert('RGB')
    flattened.save(RENDER_DIR / 'lexy-reconstructed-1024.png')
    for size in (180, 120, 60):
        flattened.resize((size, size), Image.LANCZOS).save(
            RENDER_DIR / f'lexy-reconstructed-{size}.png')
    print('wrote flattened renders (1024, 180, 120, 60)')


def apply_enclosure(canvas: Image.Image) -> Image.Image:
    enc = DESIGN['enclosure']
    scale = 4
    big = SIZE * scale
    mask = Image.new('L', (big, big), 0)
    draw = ImageDraw.Draw(mask)
    inset = enc['inset'] * scale
    draw.rounded_rectangle(
        [inset, inset, big - 1 - inset, big - 1 - inset],
        radius=enc['corner_radius'] * scale, fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
    outside = Image.new('RGBA', (SIZE, SIZE), enc['outside_color'])
    return Image.composite(canvas, outside, mask)


if __name__ == '__main__':
    main()
