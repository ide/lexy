# Visual review checklist

Reviewed 2026-07-29 against the original reference image and comparison
renders, since removed from the repo along with the comparison tooling; the
key figures are quoted inline below. Items marked "verify in Icon Composer"
need the app.

- [x] Does the L appear too large or too low? No; silhouette IoU 0.947 against
  the reference mask, centroid within 1 px (glyph centroid sits 22 px left and
  39 px below the ring center, matching the reference's optically-low placement).
- [x] Is the ring too bright at the bottom? No; ring luminance matches the
  reference within about 3 luma at every probed angle (max deviation about 5).
- [x] Does the bright red segment extend too far? No; it spans 30.1-89.5 deg
  vs 30.5-90.0 measured, within the reference's own antialiasing width.
- [x] Is the dark red segment visible but subordinate? Yes; it holds 90-25
  luma over 91-118 deg and fades out by about 140 deg, as measured.
- [x] Does the ring feel circular rather than oval? Yes; it is a true circle
  (fit residual std 0.45 px; the reference itself deviates under 1.2 px).
- [x] Is the L clearly separate from the ring? Yes; minimum clearance about 60
  px from glyph bbox to the inner ring edge, plus the baked glyph shadow.
- [x] Does the icon still read correctly on a black wallpaper? Yes in the
  flattened render; the rim light and vignette keep the enclosure edge legible.
  Also verify in Icon Composer with the system dark treatment.
- [ ] Does it remain legible on a light wallpaper? Verify in Icon Composer;
  the near-black fill should get the system's edge treatment. Avoid adding a
  manual border.
- [ ] Does Mono retain the same hierarchy? Verify in Icon Composer. The ring
  gap (dark sector from about 140-193 deg) preserves the dial motif without
  relying on red; if the dark-red arc vanishes in Mono, hide it there.
- [ ] Does Liquid Glass introduce unwanted distortion of the L? Verify in Icon
  Composer; if the thin foot terminal smears, reduce glyph translucency to 0.
- [x] At 60x60, do the ring, red accent, and L remain distinct? Yes; see
  `lexy-reconstructed-60.png` (SSIM 0.941, edge dice 0.93 vs reference at 60).
- [x] No Lexus oval, no literal Lexus logo, no text: the glyph is a traced
  6-vertex polygon, not a font glyph or the Lexus mark.
