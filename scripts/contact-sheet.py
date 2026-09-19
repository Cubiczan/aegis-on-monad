#!/usr/bin/env python3
"""Contact sheet for video frame candidates: 3 cols x 6 rows with filename labels."""
from PIL import Image, ImageDraw
import glob, os

files = sorted(glob.glob('/home/z/my-project/media/frames-tmp/t_*.jpg'))
cols, rows = 3, (len(files) + 2) // 3
tw, th, label_h = 480, 270, 22

sheet = Image.new('RGB', (cols * (tw + 8) + 8, rows * (th + label_h + 8) + 8), '#202020')
draw = ImageDraw.Draw(sheet)
for idx, f in enumerate(files):
    im = Image.open(f).resize((tw, th))
    cx, cy = idx % cols, idx // cols
    x, y = 8 + cx * (tw + 8), 8 + cy * (th + label_h + 8)
    sheet.paste(im, (x, y))
    draw.text((x + 4, y + th + 3), os.path.basename(f), fill='#ffffff')

out = '/home/z/my-project/media/frames-tmp/sheet.jpg'
sheet.save(out, quality=88)
print(out, sheet.size)
