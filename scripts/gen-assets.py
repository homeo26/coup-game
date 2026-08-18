#!/usr/bin/env python3
"""Generate Coup app visual assets: icon, adaptive icon, splash logo.

Theme: dystopian dark (near-black warm charcoal) + antique gold.
Emblem: a gold coin (the game's currency) stamped with a five-pointed
star — one point per character role.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)

BG = (14, 16, 20, 255)          # #0e1014 cool near-black
GOLD = (201, 204, 212)           # main gold
GOLD_DARK = (125, 130, 142)
GOLD_LIGHT = (233, 235, 240)
INK = (18, 20, 26)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_coin(size, ss=4):
    """Draw the coin emblem on a transparent canvas (supersampled)."""
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S / 2
    R = S * 0.48

    # Radial-ish gradient body: concentric circles from light (top-left bias)
    steps = 120
    for i in range(steps):
        t = i / (steps - 1)
        r = R * (1 - t * 0.999)
        col = lerp(GOLD_DARK, GOLD, t ** 0.8)
        d.ellipse([cx - r, cy - r - R * 0.02 * (1 - t), cx + r, cy + r], fill=col + (255,))

    # Outer rim ring
    rim_w = S * 0.030
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=GOLD_LIGHT + (255,), width=int(rim_w))
    r2 = R - rim_w * 2.2
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=GOLD_DARK + (255,), width=int(S * 0.012))

    # Reeded edge: small notches around the rim
    for k in range(72):
        a = 2 * math.pi * k / 72
        x1 = cx + math.cos(a) * (R - rim_w * 0.4)
        y1 = cy + math.sin(a) * (R - rim_w * 0.4)
        x2 = cx + math.cos(a) * R
        y2 = cy + math.sin(a) * R
        d.line([x1, y1, x2, y2], fill=GOLD_DARK + (160,), width=int(S * 0.004))

    # Inner stamped field
    rf = R * 0.80
    d.ellipse([cx - rf, cy - rf, cx + rf, cy + rf], fill=lerp(GOLD_DARK, GOLD, 0.35) + (255,))
    d.ellipse([cx - rf, cy - rf, cx + rf, cy + rf], outline=GOLD_DARK + (255,), width=int(S * 0.008))

    # Five-pointed star (5 roles), embossed dark
    def star_points(r_out, r_in, rot=-math.pi / 2):
        pts = []
        for i in range(10):
            r = r_out if i % 2 == 0 else r_in
            a = rot + i * math.pi / 5
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        return pts

    # Shadow star (offset light) then main dark star for a stamped look
    sh = S * 0.008
    d.polygon([(x + sh, y + sh) for x, y in star_points(rf * 0.78, rf * 0.34)], fill=GOLD_LIGHT + (200,))
    d.polygon(star_points(rf * 0.78, rf * 0.34), fill=INK + (255,))
    # small gold core dot
    rc = rf * 0.10
    d.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=GOLD + (255,))

    # 5 rivet dots between star points along the field edge
    for k in range(5):
        a = -math.pi / 2 + math.pi / 5 + k * 2 * math.pi / 5
        rx = cx + math.cos(a) * rf * 0.90
        ry = cy + math.sin(a) * rf * 0.90
        rr = S * 0.014
        d.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], fill=GOLD_DARK + (255,))

    return img.resize((size, size), Image.LANCZOS)


def find_font(size):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Futura.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def make_logo():
    """Transparent logo: the game's own coin token above the wordmark
    (no star — the in-game silver coin IS the brand mark)."""
    W, H = 1024, 1024
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    token = Image.open(os.path.join(os.path.dirname(OUT), "assets", "coin.png")).convert("RGBA")
    token = token.resize((560, 560), Image.LANCZOS)
    # soft drop shadow so it sits on the dark backdrop
    from PIL import ImageFilter
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    a = token.split()[3].point(lambda v: int(v * 0.5))
    shim = Image.new("RGBA", token.size, (0, 0, 0, 255))
    shim.putalpha(a)
    sh.alpha_composite(shim, ((W - 560) // 2 + 10, 60 + 14))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))
    img.alpha_composite(token, ((W - 560) // 2, 60))

    d = ImageDraw.Draw(img)
    font = find_font(190)
    text = "C O U P"
    # anchor middle: place wordmark center at (W/2, 770)
    d.text((W / 2 + 6, 770 + 8), text, font=font, fill=(0, 0, 0, 160), anchor="mm")
    d.text((W / 2, 770), text, font=font, fill=GOLD + (255,), anchor="mm")
    # thin flourish well below the wordmark
    ly = 920
    d.line([(W * 0.22, ly), (W * 0.78, ly)], fill=GOLD_DARK + (255,), width=6)
    d.ellipse([W / 2 - 10, ly - 10, W / 2 + 10, ly + 10], fill=GOLD + (255,))
    img.save(os.path.join(OUT, "logo.png"))


def make_icon():
    """Opaque app icon: coin on dark field."""
    W = 1024
    img = Image.new("RGBA", (W, W), BG)
    # subtle vignette
    vign = Image.new("L", (W, W), 0)
    dv = ImageDraw.Draw(vign)
    dv.ellipse([-W * 0.25, -W * 0.25, W * 1.25, W * 1.25], fill=40)
    img = Image.composite(Image.new("RGBA", (W, W), (32, 28, 20, 255)), img, vign)
    coin = draw_coin(820)
    img.alpha_composite(coin, ((W - 820) // 2, (W - 820) // 2))
    img.convert("RGB").save(os.path.join(OUT, "icon.png"))


def make_adaptive():
    """Transparent foreground, emblem inside the ~66% safe zone."""
    W = 1024
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    coin = draw_coin(600)
    img.alpha_composite(coin, ((W - 600) // 2, (W - 600) // 2))
    img.save(os.path.join(OUT, "adaptive-icon.png"))


if __name__ == "__main__":
    make_logo()
    make_icon()
    make_adaptive()
    print("assets written to", os.path.abspath(OUT))
