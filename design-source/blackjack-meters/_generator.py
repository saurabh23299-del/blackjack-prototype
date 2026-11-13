"""Fever meter (vertical, 3 states) and Nerve XP pill as SVGs. Typography: Roboto Slab."""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

OUT = "/home/claude/blackjack-meters"
os.makedirs(OUT, exist_ok=True)
CREAM, PANEL, EDGE, TRACK = "#FEFDD4", "#15171D", "#3A3D47", "#2A2D36"

FONT = TTFont("/home/claude/fonts/RobotoSlab-800.ttf")
GS, CMAP, UPM = FONT.getGlyphSet(), FONT.getBestCmap(), FONT["head"].unitsPerEm


def text(s, x, cy, size, anchor="middle", fill=CREAM, spacing=0.0):
    """Outlined text, vertically centred on cy (cap-height based)."""
    sc = size / UPM
    names = [CMAP[ord(c)] for c in s]
    width = sum(GS[n].width for n in names) * sc + spacing * (len(s) - 1)
    x0 = {"middle": x - width / 2, "start": x, "end": x - width}[anchor]
    cap = 1456 / 2048 * size  # Roboto Slab cap height ratio
    baseline = cy + cap / 2
    d, cx = [], x0
    for n in names:
        pen = SVGPathPen(GS)
        GS[n].draw(TransformPen(pen, (sc, 0, 0, -sc, cx, baseline)))
        d.append(pen.getCommands())
        cx += GS[n].width * sc + spacing
    return f'<path fill="{fill}" d="{" ".join(d)}"/>'


def svg(w, h, title, body, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img" aria-label="{title}">\n<title>{title}</title>\n<defs>{defs}</defs>\n{body}\n</svg>\n')


# ---------------- Fever meter (vertical) ----------------
FLAME = ("M0,-46 C14,-26 34,-14 34,10 C34,32 18,46 0,46 C-18,46 -34,32 -34,10 "
         "C-34,-6 -24,-16 -16,-26 C-14,-14 -8,-8 -2,-6 C-6,-22 -4,-36 0,-46 Z")
FLAME_CORE = "M0,6 C8,15 14,21 14,29 C14,38 8,44 0,44 C-8,44 -14,38 -14,29 C-14,21 -6,15 0,6 Z"


def fever(state):
    W, H, cx = 80, 268, 40
    tube_x, tube_w, tube_y0, tube_y1 = cx - 14, 28, 52, 226
    in_x, in_w, in_y0, in_y1 = cx - 10, 20, 70, 222
    frac = {"empty": 0, "half": .5, "full": 1}[state]
    value = {"empty": "0/50", "half": "25/50", "full": "READY"}[state]
    title = {"empty": "Fever meter: 0 of 50", "half": "Fever meter: 25 of 50",
             "full": "Fever meter full: ready to activate"}[state]
    defs = (f'<linearGradient id="fv-fill" gradientUnits="userSpaceOnUse" x1="0" y1="{in_y1}" x2="0" y2="{in_y0}">'
            f'<stop offset="0" stop-color="#FFD23F"/><stop offset=".55" stop-color="#FF8A1F"/>'
            f'<stop offset="1" stop-color="#F0442C"/></linearGradient>'
            f'<linearGradient id="fv-badge" x1="0" y1="1" x2="0" y2="0">'
            f'<stop offset="0" stop-color="#FF8A1F"/><stop offset="1" stop-color="#F0442C"/></linearGradient>'
            f'<clipPath id="fv-clip"><rect x="{in_x}" y="{in_y0}" width="{in_w}" height="{in_y1-in_y0}" rx="10"/></clipPath>'
            f'<filter id="fv-glow" x="-50%" y="-20%" width="200%" height="140%">'
            f'<feGaussianBlur stdDeviation="6"/></filter>')
    parts = []
    if state == "full":  # soft glow behind tube + badge
        parts.append(f'<g filter="url(#fv-glow)" opacity=".75" aria-hidden="true">'
                     f'<rect x="{tube_x}" y="{tube_y0}" width="{tube_w}" height="{tube_y1-tube_y0}" rx="14" fill="#FF7A1A"/>'
                     f'<circle cx="{cx}" cy="34" r="26" fill="#FF7A1A"/></g>')
    # tube
    stroke = "#FF8A1F" if state == "full" else EDGE
    parts.append(f'<rect x="{tube_x}" y="{tube_y0}" width="{tube_w}" height="{tube_y1-tube_y0}" rx="14" '
                 f'fill="{PANEL}" stroke="{stroke}" stroke-width="2"/>')
    parts.append(f'<rect x="{in_x}" y="{in_y0}" width="{in_w}" height="{in_y1-in_y0}" rx="10" fill="{TRACK}"/>')
    if frac > 0:
        fh = (in_y1 - in_y0) * frac
        parts.append(f'<g clip-path="url(#fv-clip)"><rect x="{in_x}" y="{in_y1-fh:.1f}" width="{in_w}" '
                     f'height="{fh:.1f}" fill="url(#fv-fill)"/>'
                     f'<rect x="{in_x+4}" y="{in_y1-fh+4:.1f}" width="4" height="{max(fh-8,0):.1f}" rx="2" '
                     f'fill="#FFFFFF" opacity=".28"/></g>')
    # segment dividers every 10 points (5 segments)
    seg = (in_y1 - in_y0) / 5
    for i in range(1, 5):
        y = in_y0 + seg * i
        parts.append(f'<line x1="{in_x}" y1="{y:.1f}" x2="{in_x+in_w}" y2="{y:.1f}" stroke="{PANEL}" stroke-width="2"/>')
    # flame badge
    if state == "full":
        parts.append(f'<circle cx="{cx}" cy="34" r="26" fill="url(#fv-badge)" stroke="#FFD23F" stroke-width="2"/>')
        parts.append(f'<path transform="translate({cx} 33) scale(.32)" fill="{CREAM}" d="{FLAME}"/>')
        parts.append(f'<path transform="translate({cx} 33) scale(.32)" fill="#FFB020" d="{FLAME_CORE}"/>')
    elif state == "half":
        parts.append(f'<circle cx="{cx}" cy="34" r="26" fill="{PANEL}" stroke="#FF8A1F" stroke-width="2"/>')
        parts.append(f'<path transform="translate({cx} 33) scale(.32)" fill="#FF8A1F" d="{FLAME}"/>')
        parts.append(f'<path transform="translate({cx} 33) scale(.32)" fill="{PANEL}" d="{FLAME_CORE}"/>')
    else:
        parts.append(f'<circle cx="{cx}" cy="34" r="26" fill="{PANEL}" stroke="{EDGE}" stroke-width="2"/>')
        parts.append(f'<path transform="translate({cx} 33) scale(.32)" fill="#5A5E6B" d="{FLAME}"/>')
        parts.append(f'<path transform="translate({cx} 33) scale(.32)" fill="{PANEL}" d="{FLAME_CORE}"/>')
    # value pill
    pill_stroke = "#FF8A1F" if state == "full" else EDGE
    parts.append(f'<rect x="8" y="236" width="64" height="26" rx="13" fill="{PANEL}" stroke="{pill_stroke}" stroke-width="1.5"/>')
    parts.append(text(value, cx, 249, 13 if state != "full" else 12, spacing=0.3 if state == "full" else 0))
    return svg(W, H, title, "\n".join(parts), defs)


# ---------------- Nerve XP meter (horizontal) ----------------
def star_path(cx, cy, r_out, r_in, points=5):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(-90 + i * 180 / points)
        pts.append(f"{cx + r*math.cos(a):.2f},{cy + r*math.sin(a):.2f}")
    return "M" + " L".join(pts) + " Z"


def measure(s, size, spacing=0.0):
    sc = size / UPM
    return sum(GS[CMAP[ord(c)]].width for c in s) * sc + spacing * (len(s) - 1)


def xp_pill(value):
    """Compact Nerve XP pill: star badge + value + 'XP'."""
    H, r = 48, 24
    num = f"{value:,}"
    num_w, xp_w = measure(num, 18), measure("XP", 12, 0.6)
    badge_cx, gap = 4 + 20, 10
    x_num = badge_cx + 20 + gap
    x_xp = x_num + num_w + 6
    W = round(x_xp + xp_w + 18)
    title = f"Nerve XP: {value:,}"
    defs = ('<linearGradient id="xp-badge" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="#2EE6C5"/><stop offset="1" stop-color="#1F8FFF"/></linearGradient>')
    parts = [f'<rect x="1" y="1" width="{W-2}" height="{H-2}" rx="{r-1}" fill="{PANEL}" stroke="#2EE6C5" stroke-width="1.5"/>',
             f'<circle cx="{badge_cx}" cy="{H/2}" r="19" fill="url(#xp-badge)"/>',
             f'<path fill="{CREAM}" d="{star_path(badge_cx, H/2 + 1, 10.5, 4.5)}"/>',
             text(num, x_num, H / 2, 18, anchor="start"),
             text("XP", x_xp, H / 2 + 2.5, 12, anchor="start", fill="#2EE6C5", spacing=0.6)]
    return svg(W, H, title, "\n".join(parts), defs)


if __name__ == "__main__":
    for s in ("empty", "half", "full"):
        open(f"{OUT}/fever-meter-{s}.svg", "w").write(fever(s))
    for v in (180, 1250):
        open(f"{OUT}/nerve-xp-pill-{v}.svg", "w").write(xp_pill(v))
    print("ok")
