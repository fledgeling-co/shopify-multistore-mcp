#!/usr/bin/env python3
"""
Engine A - hand-authored layered SVG master for the shopify-multi-mcp icon.

Retired on 2026-10-31: the shipping icon is now the tag ring (see build_icon.py). This builder
stays so the incumbent row in options/audit.html can be regenerated; it writes options/icon.svg.

Direction "Shopfront Row": Tahoe gel-glass sub-register (a), porcelain cushion
tile + one jade gel family, crossed with device bank #21 (authored overlap) and
#16 (the icon performs the verb).

The subject is one assistant working across several stores, so the icon is three
shopfronts under one shared rail: the rail is the assistant, each shop keeps its
own front door. The centre shop stands forward; the two side shops sit behind it
and the overlap between them is authored, so the gel visibly stacks.

Values sampled from the corpus (apple-06 Home, apple-31 News, apple-26 Reminders):
porcelain ground runs #FFFFFF at the top to #ECEAEC at the bottom; gel faces get
darker by shifting hue away from yellow (Home's amber h49 inside -> h34 outside),
so jade darkens toward teal and glows toward yellow-green; the contact shadow is
tinted with the object's hue (#ECE4D9 under Home), never grey or blue.

Palette deliberately avoids Shopify's bag green (#95BF47, h85): jade sits at h158.
Layers map 1:1 onto Icon Composer: #bg / #mid / #fg / #highlight.
"""

import pathlib

W = 1024
HERE = pathlib.Path(__file__).resolve().parent
SQUIRCLE = (HERE / "squircle-path.txt").read_text().strip()

# ---------------------------------------------------------------- palette
GROUND_TOP = "#FFFFFF"
GROUND_BOTTOM = "#ECEAEC"
VIGNETTE_OPACITY = 0.05
RIM_LIGHT_OPACITY = 0.75
RIM_LIGHT_WIDTH = 14

JADE_GLOW = "#BDF5D6"     # inner glow, toward yellow-green
JADE_LIGHT = "#4FDCA5"    # lit top of an awning
JADE = "#1CB884"          # body of the gel
JADE_DEEP = "#0D8F70"     # turned faces, toward teal
JADE_SHADE = "#0A6F5C"    # rims and the darkest gel pixel
SHADOW_TINT = "#1F7A5E"   # contact shadow takes the object's hue

BODY_TOP = "#EEF9F3"
BODY_BOTTOM = "#BFE7D4"   # pale mint: whiter bodies cost 10% contrast at 32px (round 2, rejected)
BODY_OPACITY = 0.94

# ---------------------------------------------------------------- geometry
RAIL_X0, RAIL_X1 = 178, 846
RAIL_Y, RAIL_H = 312, 46

SHOP_W_CENTRE = 262
SHOP_W_SIDE = 222
AWNING_H = 132
BODY_H = 250
SCALLOPS = 3
SIDE_LIFT = 26            # side shops sit higher, i.e. further back
OVERLAP = 30              # how far the centre shop covers each side shop
DOOR_W_FRAC = 0.36
DOOR_H_FRAC = 0.62

SHADOW_RY = 26

# Round 1 (coarse structure): the Engine C reference draws the row at 81% of the
# tile; the rubric wants a focal object near 55-65%. 1.12 lands at ~73%, a wide
# row given a little more room, without crowding the squircle corners.
OBJECT_SCALE = 1.12
OBJECT_ANCHOR = (512, 500)
OBJECT_DY = 8
SHADOW_OPACITY = 0.30
GLOW_HALO_OPACITY = 0.16  # jade light pooling at the foot (Engine C reference)
PANEL_HIGHLIGHT = 0.30    # lit centre band of each pillowed awning panel
SEAM_OPACITY = 0.35       # seam between awning panels
DOOR_FRAME = "#A6F0CF"    # inset frame light around each door
DOOR_FRAME_W = 6          # 12 cost contrast at 32px (round 3)
DOOR_GLOW = 0.40          # 0.75 lifted the darkest pixels and flattened 32px
SHADOW_BLUR = 18
AO_OPACITY = 0.20


def awning_path(x, y, w, h, n=SCALLOPS):
    """Trapezoid awning flaring out at the bottom, with n downward scallops."""
    flare = w * 0.035
    top_inset = w * 0.02
    bottom = y + h * 0.70
    r = (w + 2 * flare) / n / 2
    d = [f"M{x + top_inset:.1f},{y:.1f}", f"L{x + w - top_inset:.1f},{y:.1f}",
         f"L{x + w + flare:.1f},{bottom:.1f}"]
    for i in range(n):
        end_x = x + w + flare - (2 * i + 2) * r
        d.append(f"A{r:.1f},{h * 0.30:.1f} 0 0 1 {end_x:.1f},{bottom:.1f}")
    d.append("Z")
    return " ".join(d)


def body_path(x, y, w, h):
    """Shop body with the door cut out (even-odd), rounded at the foot."""
    inset = w * 0.06
    bx0, bx1, by1 = x + inset, x + w - inset, y + h
    rr = 18
    outer = (f"M{bx0:.1f},{y:.1f} L{bx1:.1f},{y:.1f} L{bx1:.1f},{by1 - rr:.1f} "
             f"Q{bx1:.1f},{by1:.1f} {bx1 - rr:.1f},{by1:.1f} L{bx0 + rr:.1f},{by1:.1f} "
             f"Q{bx0:.1f},{by1:.1f} {bx0:.1f},{by1 - rr:.1f} Z")
    return outer


def door_path(x, y, w, h):
    dw, dh = w * DOOR_W_FRAC, h * DOOR_H_FRAC
    dx0 = x + (w - dw) / 2
    dy0 = y + h - dh
    r = dw / 2
    return (f"M{dx0:.1f},{y + h:.1f} L{dx0:.1f},{dy0 + r:.1f} "
            f"A{r:.1f},{r:.1f} 0 0 1 {dx0 + dw:.1f},{dy0 + r:.1f} L{dx0 + dw:.1f},{y + h:.1f} Z")


def shop(x, y, w, tag, opacity=1.0):
    """One shopfront: body, under-awning occlusion, door, awning, highlights."""
    aw_y = y
    body_y = y + AWNING_H * 0.62
    body_h = BODY_H
    a = awning_path(x, aw_y, w, AWNING_H)
    b = body_path(x, body_y, w, body_h)
    dpath = door_path(x + w * 0.06, body_y, w * 0.88, body_h)
    flare = w * 0.035
    pw = (w + 2 * flare) / SCALLOPS
    panels = ""
    for i in range(SCALLOPS):
        px0 = x - flare + i * pw
        panels += (f'<rect x="{px0 + pw * 0.30:.1f}" y="{aw_y:.1f}" width="{pw * 0.40:.1f}" height="{AWNING_H:.1f}" '
                   f'fill="url(#panel-band)"/>')
        if i:
            panels += (f'<path d="M{px0:.1f},{aw_y:.1f} L{px0:.1f},{aw_y + AWNING_H * 0.70:.1f}" '
                       f'stroke="{JADE_SHADE}" stroke-opacity="{SEAM_OPACITY}" stroke-width="3"/>')
    bx0, bx1 = x + w * 0.06, x + w * 0.94
    sides = (f'<rect x="{bx0:.1f}" y="{body_y:.1f}" width="{bx1 - bx0:.1f}" height="{body_h:.1f}" '
             f'fill="url(#body-sides)"/>')
    return f"""
  <g id="shop-{tag}" opacity="{opacity}">
    <defs><clipPath id="clip-{tag}"><path d="{a}"/></clipPath><clipPath id="body-clip-{tag}"><path d="{b}"/></clipPath></defs>
    <path d="{b}" fill="url(#body)" fill-opacity="{BODY_OPACITY}" stroke="{JADE_DEEP}" stroke-opacity="0.30" stroke-width="4"/>
    <rect x="{x + w * 0.06:.1f}" y="{body_y:.1f}" width="{w * 0.88:.1f}" height="{AWNING_H * 0.42:.1f}" fill="{SHADOW_TINT}" opacity="{AO_OPACITY}" filter="url(#soft)"/>
    <g clip-path="url(#body-clip-{tag})">{sides}</g>
    <path d="{dpath}" fill="none" stroke="{DOOR_FRAME}" stroke-opacity="0.9" stroke-width="{DOOR_FRAME_W}"/>
    <path d="{dpath}" fill="url(#gel-door)"/>
    <path d="{dpath}" fill="url(#door-glow)"/>
    <path d="{dpath}" fill="none" stroke="{JADE_SHADE}" stroke-opacity="0.45" stroke-width="3"/>
    <path d="{a}" fill="url(#gel-awning)"/>
    <path d="{a}" fill="url(#gel-glow)"/>
    <g clip-path="url(#clip-{tag})">{panels}</g>
    <path d="{a}" fill="none" stroke="{JADE_SHADE}" stroke-opacity="0.55" stroke-width="3.5"/>
  </g>"""


def build():
    cx = W / 2
    centre_x = cx - SHOP_W_CENTRE / 2
    left_x = centre_x - SHOP_W_SIDE + OVERLAP
    right_x = centre_x + SHOP_W_CENTRE - OVERLAP
    shops_y = RAIL_Y + RAIL_H - 8
    side_y = shops_y - SIDE_LIFT
    foot = shops_y + AWNING_H * 0.62 + BODY_H

    rail = (f'<rect x="{RAIL_X0}" y="{RAIL_Y}" width="{RAIL_X1 - RAIL_X0}" height="{RAIL_H}" '
            f'rx="{RAIL_H / 2}" fill="url(#gel-rail)"/>'
            f'<rect x="{RAIL_X0}" y="{RAIL_Y}" width="{RAIL_X1 - RAIL_X0}" height="{RAIL_H}" '
            f'rx="{RAIL_H / 2}" fill="none" stroke="{JADE_SHADE}" stroke-opacity="0.5" stroke-width="3"/>')
    rail_hi = (f'<rect x="{RAIL_X0 + 24}" y="{RAIL_Y + 6}" width="{RAIL_X1 - RAIL_X0 - 48}" height="7" '
               f'rx="3.5" fill="#FFFFFF" opacity="0.55"/>')

    def awning_highlight(x, y, w):
        return (f'<path d="M{x + w * 0.06:.1f},{y + 7:.1f} L{x + w * 0.94:.1f},{y + 7:.1f}" '
                f'stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="5" stroke-linecap="round"/>')

    ax, ay = OBJECT_ANCHOR
    OBJ_T = f"translate({ax},{ay + OBJECT_DY}) scale({OBJECT_SCALE}) translate({-ax},{-ay})"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{W}" viewBox="0 0 {W} {W}">
<!--
  shopify-multistore-mcp icon master (retired incumbent). Direction "Shopfront Row" (porcelain register).
  Full-bleed 1024 artwork; the squircle is a CLIP, never a baked corner or shadow.
  Generated by build_icon.py; edit the constants there, never this file.
  Four layers map 1:1 onto Icon Composer: #bg / #mid / #fg / #highlight.
-->
<defs>
  <clipPath id="mask"><path d="{SQUIRCLE}"/></clipPath>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{GROUND_TOP}"/><stop offset="1" stop-color="{GROUND_BOTTOM}"/>
  </linearGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.42" r="0.72">
    <stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="{VIGNETTE_OPACITY}"/>
  </radialGradient>
  <linearGradient id="gel-awning" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{JADE_LIGHT}"/><stop offset="0.50" stop-color="{JADE}"/><stop offset="0.82" stop-color="{JADE_DEEP}"/><stop offset="1" stop-color="{JADE_SHADE}"/>
  </linearGradient>
  <radialGradient id="gel-glow" cx="0.5" cy="0.28" r="0.55">
    <stop offset="0" stop-color="{JADE_GLOW}" stop-opacity="0.55"/><stop offset="1" stop-color="{JADE_GLOW}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="gel-rail" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{JADE_LIGHT}"/><stop offset="0.5" stop-color="{JADE}"/><stop offset="1" stop-color="{JADE_DEEP}"/>
  </linearGradient>
  <linearGradient id="gel-door" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{JADE}"/><stop offset="0.6" stop-color="{JADE_DEEP}"/><stop offset="1" stop-color="{JADE_SHADE}"/>
  </linearGradient>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{BODY_TOP}"/><stop offset="1" stop-color="{BODY_BOTTOM}"/>
  </linearGradient>
  <linearGradient id="panel-band" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="{PANEL_HIGHLIGHT}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="body-sides" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{JADE_DEEP}" stop-opacity="0.16"/><stop offset="0.14" stop-color="{JADE_DEEP}" stop-opacity="0"/><stop offset="0.86" stop-color="{JADE_DEEP}" stop-opacity="0"/><stop offset="1" stop-color="{JADE_DEEP}" stop-opacity="0.20"/>
  </linearGradient>
  <radialGradient id="door-glow" cx="0.5" cy="0.25" r="0.75">
    <stop offset="0" stop-color="{JADE_GLOW}" stop-opacity="{DOOR_GLOW}"/><stop offset="0.55" stop-color="{JADE_LIGHT}" stop-opacity="0.15"/><stop offset="1" stop-color="{JADE_LIGHT}" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="shadow" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="{SHADOW_BLUR}"/></filter>
</defs>
<g clip-path="url(#mask)">
  <g id="bg">
    <rect width="{W}" height="{W}" fill="url(#ground)"/>
    <rect width="{W}" height="{W}" fill="url(#vignette)"/>
    <path d="{SQUIRCLE}" fill="none" stroke="#FFFFFF" stroke-opacity="{RIM_LIGHT_OPACITY}" stroke-width="{RIM_LIGHT_WIDTH}"/>
  </g>
  <g id="mid" transform="{OBJ_T}">
    <ellipse cx="{cx}" cy="{foot - 4:.1f}" rx="{(RAIL_X1 - RAIL_X0) / 2 + 10:.1f}" ry="{SHADOW_RY * 2:.1f}" fill="{JADE}" opacity="{GLOW_HALO_OPACITY}" filter="url(#shadow)"/>
    <ellipse cx="{cx}" cy="{foot + 6:.1f}" rx="{(RAIL_X1 - RAIL_X0) / 2 - 20:.1f}" ry="{SHADOW_RY}" fill="{SHADOW_TINT}" opacity="{SHADOW_OPACITY}" filter="url(#shadow)"/>
    {shop(left_x, side_y, SHOP_W_SIDE, "left", 0.96)}
    {shop(right_x, side_y, SHOP_W_SIDE, "right", 0.96)}
  </g>
  <g id="fg" transform="{OBJ_T}">
    {rail}
    {shop(centre_x, shops_y, SHOP_W_CENTRE, "centre")}
  </g>
  <g id="highlight" transform="{OBJ_T}">
    {rail_hi}
    {awning_highlight(left_x, side_y, SHOP_W_SIDE)}
    {awning_highlight(right_x, side_y, SHOP_W_SIDE)}
    {awning_highlight(centre_x, shops_y, SHOP_W_CENTRE)}
  </g>
</g>
</svg>
"""
    (HERE / "options" / "icon.svg").write_text(svg)
    return svg


if __name__ == "__main__":
    build()
    print(f"wrote {HERE / 'options' / 'icon.svg'}")
