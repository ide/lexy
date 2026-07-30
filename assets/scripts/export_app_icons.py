#!/usr/bin/env python3
"""Export the app-facing icon assets from the matched PNG layers.

Outputs (all overwrite files referenced by app.json):
  - assets/images/icon.png: 1024 full-bleed composite, no enclosure mask; the
    platform applies its own icon mask.
  - assets/images/android-icon-foreground.png: 512, ring + glyph on
    transparency, recentered on the ring and scaled into the adaptive-icon
    safe zone (66/108 dp circle).
  - assets/images/android-icon-monochrome.png: 432, white silhouette of the
    same artwork.
  - assets/images/favicon.png: 48, downsampled from the enclosed matched
    render so browser tabs show the rounded-square icon.
"""
import json
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parent.parent
DESIGN = json.loads((PROJECT / 'design.json').read_text())
PNG_DIR = PROJECT / 'png-layers'
IMAGES_DIR = PROJECT / 'images'
SIZE = DESIGN['canvas']['size']

ALL_LAYERS = [
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
# Foreground artwork only; shadows are omitted because adaptive-icon
# foregrounds float over an opaque background layer
FOREGROUND_LAYERS = [
    '04-ring-metal.png',
    '05-ring-highlight.png',
    '06-ring-red-bright.png',
    '07-ring-red-dark.png',
    '09-glyph-metal.png',
    '10-glyph-highlight.png',
]
MONO_LAYERS = [
    '04-ring-metal.png',
    '06-ring-red-bright.png',
    '07-ring-red-dark.png',
    '09-glyph-metal.png',
]


def main() -> None:
    full_bleed = composite(ALL_LAYERS)
    full_bleed.convert('RGB').save(IMAGES_DIR / 'icon.png')
    print('wrote images/icon.png (1024 full-bleed)')

    foreground = recentered_foreground(composite(FOREGROUND_LAYERS, transparent=True))
    foreground.resize((512, 512), Image.LANCZOS).save(
        IMAGES_DIR / 'android-icon-foreground.png')
    print('wrote images/android-icon-foreground.png (512)')

    mono = recentered_foreground(composite(MONO_LAYERS, transparent=True))
    white = Image.new('RGBA', mono.size, (255, 255, 255, 0))
    white.putalpha(mono.getchannel('A'))
    white = Image.merge('RGBA', [
        Image.new('L', mono.size, 255), Image.new('L', mono.size, 255),
        Image.new('L', mono.size, 255), mono.getchannel('A')])
    white.resize((432, 432), Image.LANCZOS).save(
        IMAGES_DIR / 'android-icon-monochrome.png')
    print('wrote images/android-icon-monochrome.png (432)')

    enclosed = Image.open(PROJECT / 'renders' / 'lexy-reconstructed-1024.png')
    enclosed.resize((48, 48), Image.LANCZOS).save(IMAGES_DIR / 'favicon.png')
    print('wrote images/favicon.png (48)')


def composite(layer_names: list, transparent: bool = False) -> Image.Image:
    background = (0, 0, 0, 0) if transparent else (0, 0, 0, 255)
    canvas = Image.new('RGBA', (SIZE, SIZE), background)
    for name in layer_names:
        canvas = Image.alpha_composite(canvas, Image.open(PNG_DIR / name).convert('RGBA'))
    return canvas


def recentered_foreground(image: Image.Image) -> Image.Image:
    """Recenter on the ring and scale the ring's outer diameter (plus a small
    margin) into the adaptive-icon safe zone (66/108 of the canvas)."""
    ring = DESIGN['ring']
    cx, cy = ring['center']
    outer_diameter = 2 * (ring['centerline_radius'] + ring['thickness'] / 2.0) + 24
    scale = (SIZE * 66.0 / 108.0) / outer_diameter
    scaled_size = int(round(SIZE * scale))
    scaled = image.resize((scaled_size, scaled_size), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    offset = (int(round(SIZE / 2.0 - cx * scale)), int(round(SIZE / 2.0 - cy * scale)))
    out.paste(scaled, offset, scaled)
    return out


if __name__ == '__main__':
    main()
