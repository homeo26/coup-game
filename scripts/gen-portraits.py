#!/usr/bin/env python3
"""Extract circular character portraits from the card photos in art-src/.

Face boxes were located with cv2 Haar cascades and verified by hue
analysis against each 2013 card's palette (Duke magenta, Captain blue,
Contessa red, Assassin steel, Ambassador warm tan).
Outputs assets/roles/{role}.png — 256px circular RGBA portraits.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageOps

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'art-src')
OUT = os.path.join(BASE, 'assets', 'roles')
os.makedirs(OUT, exist_ok=True)

# role: (file, face x, y, w, h) — best/largest verified detection each
FACES = {
    'assassin': ('assassin_contessa.jpg', 31, 116, 115, 115),
    'contessa': ('assassin_contessa.jpg', 314, 75, 74, 74),
    'duke': ('contessa_duke.jpg', 267, 133, 83, 83),
    'captain': ('characters.jpg', 128, 278, 77, 77),
    'ambassador': ('characters.jpg', 355, 63, 61, 61),
}

D = 256  # output diameter


def portrait(img: Image.Image, x, y, fw, fh) -> Image.Image:
    cx, cy = x + fw / 2, y + fh / 2 - fh * 0.06  # slight headroom bias
    side = fw * 2.05
    half = side / 2
    x0 = max(0, min(img.width - side, cx - half))
    y0 = max(0, min(img.height - side, cy - half))
    side = min(side, img.width - x0, img.height - y0)
    crop = img.crop((int(x0), int(y0), int(x0 + side), int(y0 + side)))
    crop = crop.resize((D, D), Image.LANCZOS)
    crop = ImageOps.autocontrast(crop, cutoff=1)
    # circular mask with soft edge
    mask = Image.new('L', (D, D), 0)
    ImageDraw.Draw(mask).ellipse([2, 2, D - 2, D - 2], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    out = Image.new('RGBA', (D, D), (0, 0, 0, 0))
    out.paste(crop, (0, 0), mask)
    return out


for role, (fname, x, y, fw, fh) in FACES.items():
    img = Image.open(os.path.join(SRC, fname)).convert('RGB')
    portrait(img, x, y, fw, fh).save(os.path.join(OUT, f'{role}.png'))
    print(role, 'ok')
print('portraits written to', OUT)
