#!/usr/bin/env python3
"""Generate all SVG layers from design.json and export transparent PNG layers.

Two sets are produced:
  - MATCHED set (assets/svg + assets/png-layers): gradients, shadows, and blur
    baked in; render.py flattens these into the finished raster icon.
  - COMPOSER set (assets/svg/composer): clean silhouettes with simple fills for
    Icon Composer, which applies its own material effects.

Dial angles are degrees clockwise from 12 o'clock; a dial angle t maps to
(cx + r*sin(t), cy - r*cos(t)) in SVG's y-down coordinates.
"""
import json
import math
import subprocess
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
DESIGN = json.loads((PROJECT / 'design.json').read_text())
SVG_DIR = PROJECT / 'svg'
COMPOSER_DIR = SVG_DIR / 'composer'
PNG_DIR = PROJECT / 'png-layers'
SIZE = DESIGN['canvas']['size']


def main() -> None:
    SVG_DIR.mkdir(exist_ok=True)
    COMPOSER_DIR.mkdir(exist_ok=True)
    PNG_DIR.mkdir(exist_ok=True)

    matched = {
        '00-background-base.svg': background_base(),
        '01-background-vignette.svg': background_vignette(),
        '02-background-edge.svg': background_edge(),
        '03-ring-shadow.svg': ring_shadow(),
        '04-ring-metal.svg': ring_metal(),
        '05-ring-highlight.svg': ring_highlight(),
        '06-ring-red-bright.svg': red_arc('bright'),
        '07-ring-red-dark.svg': red_arc('dark'),
        '08-glyph-shadow.svg': glyph_shadow(),
        '09-glyph-metal.svg': glyph_metal(),
        '10-glyph-highlight.svg': glyph_highlight(),
    }
    for name, body in matched.items():
        path = SVG_DIR / name
        path.write_text(svg_document(body))
        export_png(path, PNG_DIR / name.replace('.svg', '.png'))
        print(f'wrote {name}')

    composer = {
        '0-background.svg': background_base(),
        '1-ring-metal.svg': composer_ring_metal(),
        '2-ring-red-bright.svg': composer_red_bright(),
        '3-ring-red-dark.svg': composer_red_dark(),
        '4-glyph.svg': composer_glyph(),
    }
    for name, body in composer.items():
        (COMPOSER_DIR / name).write_text(svg_document(body))
        print(f'wrote composer/{name}')


# --- Geometry helpers ---

def dial_point(center, radius, t_deg) -> tuple:
    t = math.radians(t_deg)
    return (center[0] + radius * math.sin(t), center[1] - radius * math.cos(t))


def arc_path(center, radius, start, end) -> str:
    x0, y0 = dial_point(center, radius, start)
    x1, y1 = dial_point(center, radius, end)
    large = 1 if (end - start) > 180 else 0
    return f'M {x0:.2f} {y0:.2f} A {radius:.2f} {radius:.2f} 0 {large} 1 {x1:.2f} {y1:.2f}'


def annular_sector_path(center, radius_inner, radius_outer, start, end) -> str:
    """Closed filled outline of an arc segment. Icon Composer builds Liquid
    Glass silhouettes from path geometry and closes open stroked paths with a
    chord between the endpoints, so composer-set arcs must be fills."""
    ox0, oy0 = dial_point(center, radius_outer, start)
    ox1, oy1 = dial_point(center, radius_outer, end)
    ix0, iy0 = dial_point(center, radius_inner, end)
    ix1, iy1 = dial_point(center, radius_inner, start)
    large = 1 if (end - start) > 180 else 0
    return (f'M {ox0:.2f} {oy0:.2f} '
            f'A {radius_outer:.2f} {radius_outer:.2f} 0 {large} 1 {ox1:.2f} {oy1:.2f} '
            f'L {ix0:.2f} {iy0:.2f} '
            f'A {radius_inner:.2f} {radius_inner:.2f} 0 {large} 0 {ix1:.2f} {iy1:.2f} '
            f'Z')


def glyph_path() -> str:
    """Rounded polygon with true circular-arc fillets at each vertex."""
    vertices = DESIGN['glyph']['vertices']
    n = len(vertices)
    pieces = []
    entries = []
    for i, vertex in enumerate(vertices):
        v = vertex['point']
        p_prev = vertices[(i - 1) % n]['point']
        p_next = vertices[(i + 1) % n]['point']
        r = vertex['radius']
        u1 = unit((p_prev[0] - v[0], p_prev[1] - v[1]))
        u2 = unit((p_next[0] - v[0], p_next[1] - v[1]))
        cos_a = max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))
        half = math.acos(cos_a) / 2.0
        trim = r / math.tan(half) if half > 1e-6 else 0.0
        p1 = (v[0] + u1[0] * trim, v[1] + u1[1] * trim)
        p2 = (v[0] + u2[0] * trim, v[1] + u2[1] * trim)
        cross = u1[0] * u2[1] - u1[1] * u2[0]
        sweep = 1 if cross < 0 else 0
        entries.append((p1, p2, r, sweep))
    for i, (p1, p2, r, sweep) in enumerate(entries):
        if i == 0:
            pieces.append(f'M {p1[0]:.2f} {p1[1]:.2f}')
        else:
            pieces.append(f'L {p1[0]:.2f} {p1[1]:.2f}')
        pieces.append(f'A {r:.2f} {r:.2f} 0 0 {sweep} {p2[0]:.2f} {p2[1]:.2f}')
    pieces.append('Z')
    return ' '.join(pieces)


def unit(v) -> tuple:
    length = math.hypot(*v) or 1.0
    return (v[0] / length, v[1] / length)


def rgb(color) -> str:
    return f'rgb({color[0]},{color[1]},{color[2]})'


def svg_document(body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" '
            f'viewBox="0 0 {SIZE} {SIZE}">\n{body}\n</svg>\n')


def export_png(svg_path: Path, png_path: Path) -> None:
    subprocess.run(['rsvg-convert', '-w', str(SIZE), '-h', str(SIZE),
                    '-o', str(png_path), str(svg_path)], check=True)


# --- Background layers ---

def background_base() -> str:
    color = DESIGN['background']['base_color']
    return f'<rect width="{SIZE}" height="{SIZE}" fill="{color}"/>'


def background_vignette() -> str:
    v = DESIGN['background']['vignette']
    cx, cy = v['center']
    overlay_luma = (0.2126 * v['overlay_rgb'][0] + 0.7152 * v['overlay_rgb'][1]
                    + 0.0722 * v['overlay_rgb'][2])
    base_luma = 4.8
    max_opacity = v['amp_luma'] / (overlay_luma - base_luma)
    stops = []
    for offset in [0.0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.9, 1.0]:
        opacity = max_opacity * (1.0 - offset) ** v['gamma']
        stops.append(f'<stop offset="{offset}" stop-color="{rgb(v["overlay_rgb"])}" '
                     f'stop-opacity="{opacity:.4f}"/>')
    return (f'<defs><radialGradient id="vig" gradientUnits="userSpaceOnUse" '
            f'cx="{cx}" cy="{cy}" r="{v["radius"]}">{"".join(stops)}</radialGradient></defs>\n'
            f'<rect width="{SIZE}" height="{SIZE}" fill="url(#vig)"/>')


def background_edge() -> str:
    e = DESIGN['background']['edge_highlight']
    enc = DESIGN['enclosure']
    inset = e['center_inset']
    r = max(4.0, enc['corner_radius'] - (inset - enc['inset']))
    return (f'<defs><linearGradient id="edge" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="0" x2="0" y2="{SIZE}">'
            f'<stop offset="0" stop-color="#FFFFFF" stop-opacity="{e["top_opacity"]}"/>'
            f'<stop offset="1" stop-color="#FFFFFF" stop-opacity="{e["bottom_opacity"]}"/>'
            f'</linearGradient>'
            f'<filter id="eblur" x="-10%" y="-10%" width="120%" height="120%">'
            f'<feGaussianBlur stdDeviation="{e["blur"]}"/></filter></defs>\n'
            f'<rect x="{inset}" y="{inset}" width="{SIZE - 2 * inset}" height="{SIZE - 2 * inset}" '
            f'rx="{r}" fill="none" stroke="url(#edge)" stroke-width="{e["stroke_width"]}" '
            f'filter="url(#eblur)"/>')


# --- Ring layers ---

def ring_shadow() -> str:
    ring = DESIGN['ring']
    s = ring['shadow']
    cx, cy = ring['center']
    radius = ring['centerline_radius']
    width = ring['thickness'] + s['width_extra']
    return (f'<defs>'
            f'<linearGradient id="shopacity" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="{cy - radius}" x2="0" y2="{cy + radius}">'
            f'<stop offset="0" stop-color="#000" stop-opacity="{s["top_opacity"]}"/>'
            f'<stop offset="1" stop-color="#000" stop-opacity="{s["bottom_opacity"]}"/>'
            f'</linearGradient>'
            f'<filter id="blur" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feGaussianBlur stdDeviation="{s["blur"]}"/></filter></defs>\n'
            f'<circle cx="{cx + s["offset"][0]}" cy="{cy + s["offset"][1]}" r="{radius}" '
            f'fill="none" stroke="url(#shopacity)" stroke-width="{width}" filter="url(#blur)"/>')


def ring_metal() -> str:
    ring = DESIGN['ring']
    cx, cy = ring['center']
    radius = ring['centerline_radius']
    half = ring['thickness'] / 2.0
    top = cy - radius - half
    bottom = cy + radius + half
    stops = ''.join(
        f'<stop offset="{s["h"]}" stop-color="rgb({s["value"]},{s["value"]},{s["value"] + 1})"/>'
        for s in ring['metal_gradient_stops'])
    arc = arc_path(ring['center'], radius, ring['metal_arc']['start'], ring['metal_arc']['end'])
    return (f'<defs><linearGradient id="metal" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="{top}" x2="0" y2="{bottom}">{stops}</linearGradient></defs>\n'
            f'<path d="{arc}" fill="none" stroke="url(#metal)" '
            f'stroke-width="{ring["thickness"]}" stroke-linecap="butt"/>')


def ring_highlight() -> str:
    ring = DESIGN['ring']
    h = ring['highlight_arc']
    arc = arc_path(ring['center'], ring['centerline_radius'], h['start'], h['end'])
    return (f'<defs><filter id="soft" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feGaussianBlur stdDeviation="{h["blur"]}"/></filter>'
            f'<linearGradient id="hlfade" gradientUnits="userSpaceOnUse" '
            f'x1="{dial_point(ring["center"], ring["centerline_radius"], h["start"])[0]:.1f}" '
            f'y1="{dial_point(ring["center"], ring["centerline_radius"], h["start"])[1]:.1f}" '
            f'x2="{dial_point(ring["center"], ring["centerline_radius"], h["end"])[0]:.1f}" '
            f'y2="{dial_point(ring["center"], ring["centerline_radius"], h["end"])[1]:.1f}">'
            f'<stop offset="0" stop-color="#FFF" stop-opacity="0"/>'
            f'<stop offset="0.35" stop-color="#FFF" stop-opacity="{h["opacity"]}"/>'
            f'<stop offset="0.8" stop-color="#FFF" stop-opacity="{h["opacity"]}"/>'
            f'<stop offset="1" stop-color="#FFF" stop-opacity="{h["opacity"] * 0.5}"/>'
            f'</linearGradient></defs>\n'
            f'<path d="{arc}" fill="none" stroke="url(#hlfade)" '
            f'stroke-width="{ring["thickness"]}" stroke-linecap="round" filter="url(#soft)"/>')


def red_arc(which: str) -> str:
    ring = DESIGN['ring']
    spec = DESIGN['red_arcs'][which]
    radius = ring['centerline_radius']
    x0, y0 = dial_point(ring['center'], radius, spec['start'])
    x1, y1 = dial_point(ring['center'], radius, spec['end'])
    stops = ''.join(
        f'<stop offset="{s["t"]}" stop-color="{rgb(s["rgb"])}" '
        f'stop-opacity="{s.get("opacity", 1.0)}"/>' for s in spec['stops'])
    arc = arc_path(ring['center'], radius, spec['start'], spec['end'])
    return (f'<defs><linearGradient id="red{which}" gradientUnits="userSpaceOnUse" '
            f'x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}">{stops}</linearGradient></defs>\n'
            f'<path d="{arc}" fill="none" stroke="url(#red{which})" '
            f'stroke-width="{ring["thickness"]}" stroke-linecap="butt"/>')


# --- Glyph layers ---

def glyph_shadow() -> str:
    s = DESIGN['glyph']['shadow']
    c = s['contact']
    return (f'<defs><filter id="gblur" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feGaussianBlur stdDeviation="{s["blur"]}"/></filter>'
            f'<filter id="cblur" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feGaussianBlur stdDeviation="{c["blur"]}"/></filter></defs>\n'
            f'<path d="{glyph_path()}" transform="translate({s["offset"][0]},{s["offset"][1]})" '
            f'fill="#000" fill-opacity="{s["opacity"]}" filter="url(#gblur)"/>\n'
            f'{hline(c["x_range"], c["y"], c["width"], "#000", c["opacity"], "cblur")}')


def glyph_metal() -> str:
    g = DESIGN['glyph']
    y0, y1 = g['bbox_measured'][1], g['bbox_measured'][3]
    stops = ''.join(f'<stop offset="{s["h"]}" stop-color="{rgb(s["rgb"])}"/>'
                    for s in g['metal_gradient_stops'])
    return (f'<defs><linearGradient id="gmetal" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="{y0}" x2="0" y2="{y1}">{stops}</linearGradient></defs>\n'
            f'<path d="{glyph_path()}" fill="url(#gmetal)"/>')


def glyph_highlight() -> str:
    g = DESIGN['glyph']
    h = g['highlight']
    y0 = g['bbox_measured'][1]
    foot = h['foot_specular']
    bevel = h['bottom_bevel']
    edge = h['bottom_edge_shade']
    return (f'<defs>'
            f'<linearGradient id="gtop" gradientUnits="userSpaceOnUse" x1="0" y1="{y0}" x2="0" y2="{y0 + 120}">'
            f'<stop offset="0" stop-color="#FFF" stop-opacity="{h["top_edge_opacity"]}"/>'
            f'<stop offset="1" stop-color="#FFF" stop-opacity="0"/>'
            f'</linearGradient>'
            f'<filter id="hblur" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feGaussianBlur stdDeviation="0.9"/></filter>'
            f'<clipPath id="gclip"><path d="{glyph_path()}"/></clipPath></defs>\n'
            f'<g clip-path="url(#gclip)">'
            f'<path d="{glyph_path()}" fill="none" stroke="url(#gtop)" stroke-width="{h["top_edge_width"] * 2}"/>'
            f'{hline(foot["x_range"], foot["y"], foot["width"], "#FFF", foot["opacity"], "hblur")}'
            f'{hline(bevel["x_range"], bevel["y"], bevel["width"], "#FFF", bevel["opacity"], "hblur")}'
            f'{hline(edge["x_range"], edge["y"], edge["width"], "#000", edge["opacity"], "hblur")}'
            f'</g>')


def hline(x_range, y, width, color, opacity, filter_id) -> str:
    """Horizontal band as a rect; a zero-height <line> would collapse
    percentage-based filter regions to nothing in librsvg."""
    return (f'<rect x="{x_range[0]}" y="{y - width / 2.0:.2f}" '
            f'width="{x_range[1] - x_range[0]}" height="{width}" '
            f'fill="{color}" fill-opacity="{opacity}" filter="url(#{filter_id})"/>')


# --- Composer (clean) variants ---

def composer_ring_metal() -> str:
    ring = DESIGN['ring']
    cx, cy = ring['center']
    radius = ring['centerline_radius']
    half = ring['thickness'] / 2.0
    sector = annular_sector_path(ring['center'], radius - half, radius + half,
                                 ring['metal_arc']['start'], ring['metal_arc']['end'])
    return (f'<defs><linearGradient id="cmetal" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="{cy - radius - half}" x2="0" y2="{cy + radius + half}">'
            f'<stop offset="0" stop-color="#F4F4F6"/>'
            f'<stop offset="0.55" stop-color="#9A9AA0"/>'
            f'<stop offset="0.95" stop-color="#2A2A2E"/>'
            f'</linearGradient></defs>\n'
            f'<path d="{sector}" fill="url(#cmetal)"/>')


def composer_red_bright() -> str:
    ring = DESIGN['ring']
    spec = DESIGN['red_arcs']['bright']
    half = ring['thickness'] / 2.0
    radius = ring['centerline_radius']
    sector = annular_sector_path(ring['center'], radius - half, radius + half,
                                 spec['start'], spec['end'])
    return f'<path d="{sector}" fill="#F0232C"/>'


def composer_red_dark() -> str:
    ring = DESIGN['ring']
    spec = DESIGN['red_arcs']['dark']
    half = ring['thickness'] / 2.0
    radius = ring['centerline_radius']
    x0, y0 = dial_point(ring['center'], radius, spec['start'])
    x1, y1 = dial_point(ring['center'], radius, spec['end'])
    stops = ''.join(
        f'<stop offset="{s["t"]}" stop-color="{rgb(s["rgb"])}" '
        f'stop-opacity="{s.get("opacity", 1.0)}"/>' for s in spec['stops'])
    sector = annular_sector_path(ring['center'], radius - half, radius + half,
                                 spec['start'], spec['end'])
    return (f'<defs><linearGradient id="creddark" gradientUnits="userSpaceOnUse" '
            f'x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}">{stops}</linearGradient></defs>\n'
            f'<path d="{sector}" fill="url(#creddark)"/>')


def composer_glyph() -> str:
    g = DESIGN['glyph']
    y0, y1 = g['bbox_measured'][1], g['bbox_measured'][3]
    return (f'<defs><linearGradient id="cglyph" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="{y0}" x2="0" y2="{y1}">'
            f'<stop offset="0" stop-color="#F6F6F8"/>'
            f'<stop offset="1" stop-color="#AEAEB4"/>'
            f'</linearGradient></defs>\n'
            f'<path d="{glyph_path()}" fill="url(#cglyph)"/>')


if __name__ == '__main__':
    main()
