#!/usr/bin/env python3
"""Generate cyborg-style card art: an ornate circuit-filigree card back
and a subtle tech face underlay. Deterministic (seeded) — regenerate any
time with `python3 scripts/gen-cards.py`."""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "cards")
os.makedirs(OUT, exist_ok=True)

W, H = 704, 1000
STEEL = (120, 150, 190)
STEEL_BRIGHT = (170, 200, 235)
SILVER = (201, 204, 212)
BG = (13, 15, 20)


def circuit_layer(seed, n_traces, box, thickness=3, pad_r=5):
    """Mirrored Manhattan circuit traces with terminal pads."""
    rng = random.Random(seed)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box

    def trace(sx, sy):
        pts = [(sx, sy)]
        x, y = sx, sy
        for _ in range(rng.randint(3, 6)):
            if rng.random() < 0.5:
                x = rng.randint(x0, (x0 + x1) // 2)  # stay on left half; mirrored later
            else:
                y = rng.randint(y0, y1)
            pts.append((x, y))
        # snap to orthogonal path
        path = [pts[0]]
        for px, py in pts[1:]:
            lx, ly = path[-1]
            path.append((px, ly))
            path.append((px, py))
        return path

    for i in range(n_traces):
        sx = rng.choice([x0, rng.randint(x0, (x0 + x1) // 2)])
        sy = rng.randint(y0, y1)
        path = trace(sx, sy)
        col = STEEL if i % 3 else STEEL_BRIGHT
        d.line(path, fill=col + (255,), width=thickness, joint="curve")
        ex, ey = path[-1]
        d.ellipse([ex - pad_r, ey - pad_r, ex + pad_r, ey + pad_r], fill=col + (255,))
        d.ellipse(
            [ex - pad_r + 2, ey - pad_r + 2, ex + pad_r - 2, ey + pad_r - 2], fill=BG + (255,)
        )
    # mirror left half onto right for symmetry
    left = layer.crop((0, 0, W // 2, H))
    layer.paste(left.transpose(Image.FLIP_LEFT_RIGHT), (W // 2, 0), left.transpose(Image.FLIP_LEFT_RIGHT))
    return layer


def hex_points(cx, cy, r, rot=0.0):
    return [
        (cx + r * math.cos(rot + math.pi / 3 * i), cy + r * math.sin(rot + math.pi / 3 * i))
        for i in range(6)
    ]


def glow(img, radius, alpha):
    g = img.filter(ImageFilter.GaussianBlur(radius))
    a = g.split()[3].point(lambda v: int(v * alpha))
    g.putalpha(a)
    return g


def make_back():
    img = Image.new("RGBA", (W, H), BG + (255,))
    d = ImageDraw.Draw(img)

    # vertical sheen
    for y in range(H):
        t = abs(y - H / 2) / (H / 2)
        c = tuple(int(BG[i] + (10 - 10 * t)) for i in range(3))
        d.line([(0, y), (W, y)], fill=c + (255,))

    traces = circuit_layer(7, 26, (36, 36, W - 36, H - 36))
    img.alpha_composite(glow(traces, 10, 0.55))
    img.alpha_composite(traces)

    # center emblem: nested hexagons + mechanical eye
    cx, cy = W / 2, H / 2
    emb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    de = ImageDraw.Draw(emb)
    # clear a disc behind the emblem so traces don't clutter it
    d_img = ImageDraw.Draw(img)
    d_img.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], fill=BG + (255,))
    for r, wd, col in ((138, 6, SILVER), (112, 3, STEEL), (88, 5, STEEL_BRIGHT)):
        de.polygon(hex_points(cx, cy, r, rot=math.pi / 6), outline=col + (255,), width=wd)
    # eye: iris ring + glowing pupil + lens lines
    de.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], outline=SILVER + (255,), width=5)
    de.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], outline=STEEL + (255,), width=2)
    de.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=STEEL_BRIGHT + (255,))
    de.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=BG + (255,))
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        de.line(
            [cx + 56 * math.cos(a), cy + 56 * math.sin(a), cx + 74 * math.cos(a), cy + 74 * math.sin(a)],
            fill=STEEL + (255,),
            width=3,
        )
    img.alpha_composite(glow(emb, 8, 0.6))
    img.alpha_composite(emb)

    # double border frame
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, W - 10, H - 10], radius=46, outline=SILVER + (200,), width=4)
    d.rounded_rectangle([24, 24, W - 24, H - 24], radius=38, outline=STEEL + (140,), width=2)

    img.save(os.path.join(OUT, "back.png"))
    print("back.png")


def make_face():
    """Subtle tech underlay for card faces: circuitry hugs the borders,
    center stays clean for the portrait. Neutral tones — the role tint
    is applied by the component on top."""
    img = Image.new("RGBA", (W, H), (16, 18, 24, 255))
    traces = circuit_layer(21, 14, (26, 26, W - 26, H - 26), thickness=2, pad_r=4)
    # hollow the middle so the portrait area stays calm
    mask = Image.new("L", (W, H), 255)
    dm = ImageDraw.Draw(mask)
    dm.rounded_rectangle([90, 150, W - 90, H - 210], radius=60, fill=0)
    traces.putalpha(Image.composite(traces.split()[3], Image.new("L", (W, H), 0), mask))
    faded = traces.copy()
    a = faded.split()[3].point(lambda v: int(v * 0.34))
    faded.putalpha(a)
    img.alpha_composite(glow(faded, 6, 0.4))
    img.alpha_composite(faded)
    # corner nodes
    d = ImageDraw.Draw(img)
    for cx, cy in ((40, 40), (W - 40, 40), (40, H - 40), (W - 40, H - 40)):
        d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], outline=STEEL + (120,), width=2)
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=STEEL + (150,))
    img.save(os.path.join(OUT, "face.png"))
    print("face.png")


if __name__ == "__main__":
    make_back()
    make_face()
    print("card art written to", os.path.abspath(OUT))
