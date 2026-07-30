# Importing the Lexy icon into Icon Composer

Two starting points are provided; use whichever fits your workflow.

## Option A: open the prebuilt document

Open `Lexy.icon` in Icon Composer (Xcode 26+ tooling). It was generated from the
COMPOSER asset set with the same schema as the app's previous Icon Composer
document (`assets/expo.icon`, since removed). This document is what `app.json`
references via `ios.icon`. Verify the following after opening, since the
document was written programmatically rather than saved by the app:

1. Layer z-order. Expected back-to-front: Ring metal, Red arc bright, Red arc
   dark, then the L glyph group. None of the shapes overlap, so if the app
   interprets the group order differently the icon still renders correctly;
   reorder in the sidebar only if a future edit introduces overlap.
2. Background fill. The document sets a flat near-black fill
   (`#040405`-equivalent). The reference's soft top-left vignette is
   intentionally NOT baked; if you want it, adjust the background gradient in
   Icon Composer's background inspector rather than importing
   `01-background-vignette.svg`.
3. Material settings. Both groups enable Liquid Glass (`glass`), specular, and a
   neutral shadow. Tune "translucency", "specular", and shadow opacity by eye;
   the values in `icon.json` are starting points, not measured quantities.

## Option B: assemble manually from the COMPOSER set

Import from `assets/svg/composer/`, one layer per file, ordered back to front:

| Order | File | Notes |
| --- | --- | --- |
| 0 | `0-background.svg` | Optional; prefer Icon Composer's native background fill |
| 1 | `1-ring-metal.svg` | Satin arc, vertical silver gradient |
| 2 | `2-ring-red-bright.svg` | Flat bright red arc |
| 3 | `3-ring-red-dark.svg` | Dark crimson arc with baked fade (see below) |
| 4 | `4-glyph.svg` | L silhouette, simple vertical gradient |

Group "Ring" = layers 1-3; group "Glyph" = layer 4, matching the numbering
convention in the main deliverables (background 00-02, ring 03-07, glyph
08-10). The matched-set layers 03/05/08/10 (shadows and highlights) are
deliberately excluded: leave shadow, specular, and gloss to Icon Composer's
material system per Apple's guidance.

All SVGs share the same 1024x1024 canvas and are already positioned; do not
recenter or rescale on import, and do not apply any rounded-rectangle mask; the
system enclosure crops the artwork.

## Checks before exporting

- Inspect Default, Dark, and Mono appearances. In Mono, confirm the ring and
  glyph remain distinct through luminance alone; the red arc may render as
  gray, which is acceptable because the ring gap still implies the dial motif.
  If the dark-red arc disappears in Mono, hide that layer for the Mono
  appearance instead of brightening it.
- Preview on light and dark wallpapers; the near-black fill needs the subtle
  edge treatment Icon Composer applies automatically, so avoid adding a manual
  border.
- Check the 60x60 preview: ring, red accent, and L must stay distinct.
- Watch for Liquid Glass distortion of the L's thin foot; if the terminal
  smears, reduce the glyph group's translucency toward 0.

## SVG constraints for Icon Composer

All composer-set shapes are closed, filled outlines; there are no stroked
paths. Icon Composer builds each layer's Liquid Glass silhouette from the path
geometry and closes open stroked paths with a straight chord between the arc
endpoints, which shows up as glassy edges/lines bridging the arc ends. The
arcs are therefore emitted as filled annular sectors
(`annular_sector_path` in `assets/scripts/export_layers.py`). If you edit
these files, keep everything as fills.

If the dark-red arc's baked opacity fade renders oddly under glass (it uses
gradient `stop-opacity`), replace its fill with a flat `#5A1114` and accept a
slightly harder tail.

## Known deviations from the raster reference

- The `3-ring-red-dark.svg` arc keeps a baked opacity fade because Icon
  Composer has no per-layer angular fade; this is the one matched-set effect
  retained in the composer set.
- The ring's fade-to-black at the bottom is baked into the metal gradient
  (vertical, not angular); it approximates the reference within a few luma
  levels at every measured angle.
- The vignette, rim light, ring shadow, glyph shadow, and specular lines exist
  only in the MATCHED set (`assets/svg/00...10`), which produces the finished
  raster renders in `assets/renders/`.
