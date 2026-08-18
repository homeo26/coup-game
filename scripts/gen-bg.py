#!/usr/bin/env python3
"""Generate the home screen's neon-cyborg backdrop.

Deep near-black with a perspective grid, circuit traces and darkened
neon glows in all five character colours. Deliberately dim so content
stays readable — the app layers a slow breathing wash on top.
Regenerate with: python3 scripts/gen-bg.py
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
W, H = 768, 1536
BASE = (5, 7, 11)

# character colours, darkened for a moody neon (not bright washes)
ROLES = {
    "duke": (200, 53, 91),
    "assassin": (139, 147, 163),
    "captain": (77, 143, 219),
    "ambassador": (168, 178, 62),
    "contessa": (224, 90, 51),
}
DARK = 0.5  # neon dimming factor


def dim(c, f=DARK):
    return tuple(int(v * f) for v in c)


def glow_blob(size, color, radius):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy, r = size
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))
    return layer.filter(ImageFilter.GaussianBlur(radius))


def main():
    img = Image.new("RGB", (W, H), BASE)

    # --- darkened neon glows, one per character, spread around the frame
    spots = [
        ("duke", (int(W * 0.12), int(H * 0.10), int(W * 0.42))),
        ("captain", (int(W * 0.92), int(H * 0.24), int(W * 0.40))),
        ("contessa", (int(W * 0.08), int(H * 0.62), int(W * 0.38))),
        ("ambassador", (int(W * 0.9), int(H * 0.7), int(W * 0.44))),
        ("assassin", (int(W * 0.5), int(H * 0.95), int(W * 0.44))),
    ]
    for role, spot in spots:
        blob = glow_blob(spot, dim(ROLES[role], 0.62), 140)
        a = blob.split()[3].point(lambda v: int(v * 0.72))
        blob.putalpha(a)
        img = Image.alpha_composite(img.convert("RGBA"), blob).convert("RGB")

    # --- perspective floor grid (cyborg horizon), very dim
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dg = ImageDraw.Draw(grid)
    horizon = int(H * 0.42)
    vp = (W / 2, horizon)
    line = dim((90, 150, 190), 0.75) + (110,)
    for k in range(-9, 10):  # fanning verticals
        x_bottom = W / 2 + k * (W / 7)
        dg.line([vp, (x_bottom, H)], fill=line, width=2)
    y = horizon + 6
    step = 7
    while y < H:  # receding horizontals
        dg.line([(0, y), (W, y)], fill=line, width=2)
        step = int(step * 1.28) + 2
        y += step
    grid = grid.filter(ImageFilter.GaussianBlur(0.6))
    img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")

    # --- circuit traces in the upper half, each in a character colour
    tr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dt = ImageDraw.Draw(tr)
    rng = random.Random(11)
    names = list(ROLES)
    for i in range(22):
        col = dim(ROLES[names[i % len(names)]], 0.85)
        x = rng.choice([0, W]) if i % 2 else rng.randint(0, W)
        y = rng.randint(0, horizon + 120)
        pts = [(x, y)]
        for _ in range(rng.randint(2, 4)):
            lx, ly = pts[-1]
            if rng.random() < 0.5:
                pts.append((lx + rng.choice([-1, 1]) * rng.randint(40, 170), ly))
            else:
                pts.append((lx, ly + rng.choice([-1, 1]) * rng.randint(30, 130)))
        dt.line(pts, fill=col + (150,), width=2, joint="curve")
        ex, ey = pts[-1]
        dt.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], fill=col + (190,))
    img = Image.alpha_composite(img.convert("RGBA"), tr.filter(ImageFilter.GaussianBlur(0.7))).convert("RGB")
    # bloom pass so the neon reads as light, still dim
    bloom = img.filter(ImageFilter.GaussianBlur(26))
    img = Image.blend(img, bloom, 0.35)

    # --- vignette: keep the centre calm for content
    vig = Image.new("L", (W, H), 0)
    dv = ImageDraw.Draw(vig)
    dv.ellipse([-W * 0.35, -H * 0.12, W * 1.35, H * 1.12], fill=190)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(img, Image.new("RGB", (W, H), BASE), vig)

    img.save(os.path.join(OUT, "bg-neon.png"), optimize=True)
    mean = sum(sum(p) for p in img.getdata()) / (W * H * 3)
    print(f"bg-neon.png written (mean luminance {mean:.1f}/255)")


if __name__ == "__main__":
    main()
