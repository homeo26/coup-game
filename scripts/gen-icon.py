#!/usr/bin/env python3
"""Build app icons from the character photo, face-centered.

icon.png          — full-bleed face crop, dark vignette + gold ring accents
adaptive-icon.png — circular face badge inside the Android safe zone
"""
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

# NOTE: the original photo was removed from Downloads. The composed icon
# is preserved at art-src/icon-face-backup.png; this script needs the raw
# photo to regenerate from scratch.
SRC = '/Users/homeo/Downloads/Telegram Desktop/photo_2026-08-16_16-30-55.jpg'
OUT = __file__.rsplit('/', 2)[0] + '/assets'

GOLD = (201, 204, 212)
GOLD_LIGHT = (233, 235, 240)
BG = (14, 16, 20)


def face_square():
    img = cv2.imread(SRC)
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    fc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = fc.detectMultiScale(gray, 1.08, 5, minSize=(60, 60))
    if len(faces) == 0:
        sys.exit('no face found')
    # largest detection = the subject
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    cx, cy = x + fw / 2, y + fh / 2
    side = int(fw * 1.95)
    # bias upward slightly: faces read better with extra headroom
    cy -= fh * 0.12
    half = side / 2
    x0 = int(max(0, min(w - side, cx - half)))
    y0 = int(max(0, min(h - side, cy - half)))
    side = min(side, w - x0, h - y0)
    crop = img[y0:y0 + side, x0:x0 + side]
    crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    return Image.fromarray(crop)


def make_icon(face: Image.Image):
    W = 1024
    img = face.resize((W, W), Image.LANCZOS)
    # gentle contrast + saturation lift so it pops as an icon
    img = ImageOps.autocontrast(img, cutoff=1)
    # dark vignette
    vign = Image.new('L', (W, W), 0)
    d = ImageDraw.Draw(vign)
    d.ellipse([-W * 0.12, -W * 0.12, W * 1.12, W * 1.12], fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(150))
    dark = Image.new('RGB', (W, W), BG)
    img = Image.composite(img, dark, vign)
    # gold framing ring near the edge
    d = ImageDraw.Draw(img)
    for r, col, wd in ((30, GOLD, 10), (46, GOLD_LIGHT, 4)):
        d.rounded_rectangle([r, r, W - r, W - r], radius=170, outline=col, width=wd)
    img.save(OUT + '/icon.png')


def make_adaptive(face: Image.Image):
    W = 1024
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    D = 640  # inside the ~66% safe zone
    f = face.resize((D, D), Image.LANCZOS)
    mask = Image.new('L', (D, D), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, D, D], fill=255)
    img.paste(f, ((W - D) // 2, (W - D) // 2), mask)
    d = ImageDraw.Draw(img)
    c0 = (W - D) // 2
    d.ellipse([c0 - 2, c0 - 2, c0 + D + 2, c0 + D + 2], outline=GOLD, width=12)
    d.ellipse([c0 + 12, c0 + 12, c0 + D - 12, c0 + D - 12], outline=GOLD_LIGHT, width=4)
    img.save(OUT + '/adaptive-icon.png')


if __name__ == '__main__':
    face = face_square()
    make_icon(face)
    make_adaptive(face)
    print('icons written to', OUT)
