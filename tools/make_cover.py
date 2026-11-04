"""Build showcase/cover.png (1200x630) from the real desktop screenshot, with a title bar.

usage: python3 tools/make_cover.py <screenshot.png> <title> <subtitle> <out.png>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def main(shot, title, subtitle, out):
    W, H = 1200, 630
    bar = 64
    canvas = Image.new("RGB", (W, H), "#faf6f1")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, W, bar], fill="#1d1b19")
    for i, col in enumerate(["#ff5f57", "#febc2e", "#28c840"]):
        cx = 28 + i * 26
        draw.ellipse([cx - 7, bar // 2 - 7, cx + 7, bar // 2 + 7], fill=col)
    f_title = ImageFont.truetype(FONT_BOLD, 24)
    f_sub = ImageFont.truetype(FONT, 20)
    draw.text((120, 18), title, font=f_title, fill="#faf6f1")
    draw.text((120 + draw.textlength(title, font=f_title) + 18, 22), subtitle, font=f_sub, fill="#d9a48f")
    shot_img = Image.open(shot).convert("RGB")
    target_w = W - 80
    scale = target_w / shot_img.width
    resized = shot_img.resize((target_w, int(shot_img.height * scale)), Image.LANCZOS)
    area_h = H - bar - 40
    resized = resized.crop((0, 0, target_w, min(area_h, resized.height)))
    canvas.paste(resized, (40, bar + 20))
    canvas.save(out, "PNG", optimize=True)
    print(out, canvas.size)


if __name__ == "__main__":
    main(*sys.argv[1:5])
