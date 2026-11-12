# Usage: python3 compose.py [v5notes-client2 root]
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()

def dialog_bbox(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    step = 3
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if r > 246 and g > 245 and b > 238:
                minx = min(minx, x); miny = min(miny, y)
                maxx = max(maxx, x); maxy = max(maxy, y)
    return (max(minx - 10, 0), max(miny - 10, 0), min(maxx + 12, w), min(maxy + 12, h))

before_path = ROOT + "/design-demos/settings/shots/settings-before-current.png"
after_path = ROOT + "/design-demos/settings/shots/settings-redesigned.png"
bimg = Image.open(before_path).convert("RGB").crop(dialog_bbox(before_path))
aimg = Image.open(after_path).convert("RGB").crop(dialog_bbox(after_path))

target_h = 1320

def fit(im):
    ratio = target_h / im.height
    return im.resize((round(im.width * ratio), target_h), Image.LANCZOS)

bimg, aimg = fit(bimg), fit(aimg)
pad, gap, label_h = 44, 44, 104
canvas = Image.new("RGB", (bimg.width + aimg.width + pad * 2 + gap, target_h + label_h + pad), (243, 241, 234))
draw = ImageDraw.Draw(canvas)

def load_font(size):
    for path in ("/System/Library/Fonts/Hiragino Sans GB.ttc",
                 "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
                 "/System/Library/Fonts/Supplemental/Songti.ttc"):
        try:
            font = ImageFont.truetype(path, size)
            if font.getbbox("改前")[2] > size:
                return font
        except Exception:
            continue
    return ImageFont.load_default()

font_title = load_font(30)
font_sub = load_font(21)

right_x = pad + bimg.width + gap
draw.text((pad, 14), "改前 · 720 × 708", font=font_title, fill=(52, 68, 57))
draw.text((pad, 56), "平板式表单：分组只靠分隔线，动作条与内容挤在一起", font=font_sub, fill=(122, 134, 123))
draw.text((right_x, 14), "改后 · 760 × 708", font=font_title, fill=(52, 68, 57))
draw.text((right_x, 56), "分组卡片 + 状态胶囊 + 固定动作条，内容区独立滚动", font=font_sub, fill=(122, 134, 123))

canvas.paste(bimg, (pad, label_h))
canvas.paste(aimg, (pad + bimg.width + gap, label_h))
out = ROOT + "/design-demos/settings/shots/settings-redesign-before-after.png"
canvas.save(out)
print("saved", out, canvas.size)
