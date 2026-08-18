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


def make_faces():
    """Fully illustrated card faces, one per character: chamfered cyber
    frame, role-tinted circuit field, hex portrait window with chrome
    ring and scanlines, corner brackets and an emblem watermark. Text is
    NOT baked in — the component draws the localized name."""
    FW, FH = 512, 728
    ROLES = {
        "duke": (200, 53, 91),
        "assassin": (139, 147, 163),
        "captain": (77, 143, 219),
        "ambassador": (168, 178, 62),
        "contessa": (224, 90, 51),
    }
    art_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "roles")

    for role, col in ROLES.items():
        img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        # chamfered card silhouette (cyborg panel shape)
        cut = 46
        shape = [
            (cut, 0), (FW - cut, 0), (FW, cut), (FW, FH - cut),
            (FW - cut, FH), (cut, FH), (0, FH - cut), (0, cut),
        ]
        d.polygon(shape, fill=(16, 18, 24, 255))

        mask = Image.new("L", (FW, FH), 0)
        ImageDraw.Draw(mask).polygon(shape, fill=255)

        # role-tinted glow field: strongest at the top, fading out — the
        # dark panel stays dominant so the card reads as unlit metal.
        field = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        df = ImageDraw.Draw(field)
        for y in range(FH):
            t = y / FH
            a = int(46 * (1 - t) ** 1.6 + 6)
            df.line([(0, y), (FW, y)], fill=col + (a,))
        fa = field.split()[3].point(lambda v: v)
        field.putalpha(Image.composite(fa, Image.new("L", (FW, FH), 0), mask))
        img.alpha_composite(field)

        # corner glow pools for depth
        pool = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        dp = ImageDraw.Draw(pool)
        dp.ellipse([-120, -200, FW + 120, 260], fill=col + (34,))
        pool = pool.filter(ImageFilter.GaussianBlur(60))
        pool.putalpha(Image.composite(pool.split()[3], Image.new("L", (FW, FH), 0), mask))
        img.alpha_composite(pool)

        # circuit traces in the role colour, glowing, kept off-centre
        tr = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        dt = ImageDraw.Draw(tr)
        rng = random.Random(hash(role) & 0xFFFF)
        for i in range(16):
            y = rng.randint(40, FH - 40)
            x = rng.choice([18, 34, FW - 18, FW - 34])
            run = rng.randint(50, 150)
            dx = 1 if x < FW / 2 else -1
            pts = [(x, y), (x + dx * run, y), (x + dx * run, y + rng.choice([-1, 1]) * rng.randint(30, 90))]
            bright = tuple(min(255, c + 60) for c in col)
            dt.line(pts, fill=(bright if i % 3 == 0 else col) + (210,), width=3, joint="curve")
            ex, ey = pts[-1]
            dt.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=col + (230,))
        tr = Image.composite(tr, Image.new("RGBA", (FW, FH), (0, 0, 0, 0)), mask)
        img.alpha_composite(glow(tr, 7, 0.5))
        img.alpha_composite(tr)

        # emblem watermark: big faint hexagon behind everything
        wm = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        dw = ImageDraw.Draw(wm)
        dw.polygon(hex_points(FW / 2, FH * 0.42, 190, math.pi / 6), outline=col + (60,), width=10)
        img.alpha_composite(wm)

        # hex portrait window
        pcx, pcy, pr = FW / 2, FH * 0.40, 150
        port_path = os.path.join(art_dir, f"{role}.png")
        if os.path.exists(port_path):
            port = Image.open(port_path).convert("RGBA").resize((int(pr * 2), int(pr * 2)), Image.LANCZOS)
            hexmask = Image.new("L", (FW, FH), 0)
            ImageDraw.Draw(hexmask).polygon(hex_points(pcx, pcy, pr, math.pi / 6), fill=255)
            layer = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
            layer.paste(port, (int(pcx - pr), int(pcy - pr)))
            img.paste(layer, (0, 0), Image.composite(layer.split()[3], Image.new("L", (FW, FH), 0), hexmask))
            # scanlines over the portrait
            sl = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
            dsl = ImageDraw.Draw(sl)
            for y in range(int(pcy - pr), int(pcy + pr), 4):
                dsl.line([(pcx - pr, y), (pcx + pr, y)], fill=(0, 0, 0, 60), width=1)
            img.alpha_composite(Image.composite(sl, Image.new("RGBA", (FW, FH), (0, 0, 0, 0)), hexmask))
        # chrome hex ring + inner tint ring
        dr = ImageDraw.Draw(img)
        dr.polygon(hex_points(pcx, pcy, pr + 8, math.pi / 6), outline=SILVER + (235,), width=7)
        dr.polygon(hex_points(pcx, pcy, pr - 4, math.pi / 6), outline=col + (200,), width=3)
        # bolts at the hex vertices
        for vx, vy in hex_points(pcx, pcy, pr + 8, math.pi / 6):
            dr.ellipse([vx - 7, vy - 7, vx + 7, vy + 7], fill=SILVER + (255,))
            dr.ellipse([vx - 3, vy - 3, vx + 3, vy + 3], fill=(16, 18, 24, 255))

        # corner brackets
        b, ln, wd = 26, 54, 5
        for (bx, by, sx, sy) in (
            (b, b + 22, 1, 1), (FW - b, b + 22, -1, 1),
            (b, FH - b - 22, 1, -1), (FW - b, FH - b - 22, -1, -1),
        ):
            dr.line([(bx, by), (bx + sx * ln, by)], fill=SILVER + (220,), width=wd)
            dr.line([(bx, by), (bx, by + sy * ln)], fill=SILVER + (220,), width=wd)

        # bottom plate backing (component draws the name on top)
        dr.rounded_rectangle([54, FH - 148, FW - 54, FH - 66], radius=16,
                             fill=(9, 11, 15, 225), outline=col + (200,), width=4)
        # frame edge along the chamfered silhouette
        dr.line(shape + [shape[0]], fill=SILVER + (150,), width=4, joint="curve")

        img.save(os.path.join(OUT, f"face-{role}.png"))
        print(f"face-{role}.png")


if __name__ == "__main__":
    make_back()
    make_face()
    make_faces()
    print("card art written to", os.path.abspath(OUT))
