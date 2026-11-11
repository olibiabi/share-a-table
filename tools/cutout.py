"""Remove the white background (flood fill from the border), crop, shrink, save transparent PNGs.
Usage: python cutout.py RAW_DIR OUT_DIR SHEET.png [name ...]"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw

raw, out, sheet = sys.argv[1], sys.argv[2], sys.argv[3]
names = sys.argv[4:] or sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(raw, '*.png')))
os.makedirs(out, exist_ok=True)

def shift(m, dy, dx):
    r = np.roll(np.roll(m, dy, 0), dx, 1)
    return r

thumbs = []
for n in names:
    im = Image.open(os.path.join(raw, n + '.png')).convert('RGB')
    w, h = im.size
    marked = im.copy()
    KEY = (255, 0, 254)
    # seed the flood fill all around the border
    for x in range(0, w, 16):
        for y in (0, h - 1):
            if sum(marked.getpixel((x, y))) > 690: ImageDraw.floodfill(marked, (x, y), KEY, thresh=22)
    for y in range(0, h, 16):
        for x in (0, w - 1):
            if sum(marked.getpixel((x, y))) > 690: ImageDraw.floodfill(marked, (x, y), KEY, thresh=22)
    a = np.asarray(marked)
    bg = (a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 254)
    rgb = np.asarray(im).astype(np.float32)
    alpha = np.where(bg, 0.0, 1.0)
    # soften the edge: object pixels touching the background fade by how white they are
    near = np.zeros_like(bg)
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            near |= shift(bg, dy, dx)
    edge = near & ~bg
    whiteness = rgb.min(axis=2)
    alpha[edge] = np.clip((255 - whiteness[edge]) / 45, 0, 1)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    bbox = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if bbox:
        pad = 8
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        img = img.crop(bbox)
    img.thumbnail((640, 640), Image.LANCZOS)
    img.save(os.path.join(out, n + '.png'), optimize=True)
    t = Image.new('RGB', (220, 240), (238, 226, 205))
    th = img.copy(); th.thumbnail((200, 200))
    t.paste(th, ((220 - th.width) // 2, (210 - th.height) // 2), th)
    ImageDraw.Draw(t).text((8, 222), n, fill=(40, 30, 30))
    thumbs.append(t)

cols = 6
rows = (len(thumbs) + cols - 1) // cols
S = Image.new('RGB', (cols * 220, rows * 240), (255, 255, 255))
for i, t in enumerate(thumbs):
    S.paste(t, ((i % cols) * 220, (i // cols) * 240))
S.save(sheet)
print('done', len(thumbs))
