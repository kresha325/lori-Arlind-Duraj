#!/usr/bin/env python3
"""Build a TV-ready MP4 that mirrors slide.html (8s per slide + price bar)."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SLIDES_JSON = ROOT / "assets" / "data" / "slides.json"
OUT_MP4 = ROOT / "assets" / "videos" / "lori-tv-slider.mp4"

# Full HD for smart TV / USB playback
W, H = 1920, 1080
SLIDE_SEC = 8
FPS = 30

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

BG = (12, 12, 12)
PRICE_BG = (28, 16, 8, 235)
PRICE_BORDER = (212, 160, 23, 255)
LABEL_COLOR = (255, 236, 190, 230)
VALUE_COLOR = (255, 179, 0, 255)


def cover_resize(img: Image.Image, tw: int, th: int) -> Image.Image:
    iw, ih = img.size
    scale = max(tw / iw, th / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def fmt_price(price: float) -> str:
    return f"{float(price):.2f}€"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def draw_rounded_rect(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline, width: int):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def render_price_bar(base: Image.Image, prices: list) -> Image.Image:
    if not prices:
        return base

    multi = len(prices) > 1 or (prices[0].get("label") not in (None, ""))
    label_size = 22 if multi else 24
    value_size = 42 if multi else 52
    font_label = load_font(FONT_BOLD, label_size)
    font_value = load_font(FONT_BOLD, value_size)

    gap = 48 if multi else 14
    pad_x, pad_y = 42, 16
    row_gap = 10

    rows = []
    for p in prices:
        label = (p.get("label") or "").strip()
        value = fmt_price(p["price"])
        lw = font_label.getlength(label) if label else 0
        vw = font_value.getlength(value)
        rows.append((label, value, lw, vw))

    if multi:
        content_w = sum(lw + (row_gap if label else 0) + vw for label, value, lw, vw in rows)
        content_w += gap * (len(rows) - 1)
    else:
        label, value, lw, vw = rows[0]
        content_w = lw + (row_gap if label else 0) + vw

    bar_h = max(value_size + pad_y * 2, 56)
    bar_w = int(content_w + pad_x * 2)
    bar_w = min(bar_w, W - 64)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bottom = int(H * 0.032) + 18
    y1 = H - bottom - bar_h
    x0 = (W - bar_w) // 2
    box = (x0, y1, x0 + bar_w, y1 + bar_h)
    draw_rounded_rect(draw, box, radius=10, fill=PRICE_BG, outline=PRICE_BORDER, width=3)
    draw.rounded_rectangle(
        (x0 + 2, y1 + 2, x0 + bar_w - 2, y1 + bar_h - 2),
        radius=8,
        outline=(255, 200, 80, 30),
        width=1,
    )

    x = x0 + pad_x
    cy = y1 + bar_h // 2
    for i, (label, value, lw, vw) in enumerate(rows):
        if label:
            draw.text(
                (x, cy),
                label.upper(),
                font=font_label,
                fill=LABEL_COLOR,
                anchor="lm",
            )
            x += lw + row_gap
        draw.text((x, cy), value, font=font_value, fill=VALUE_COLOR, anchor="lm")
        x += vw
        if multi and i < len(rows) - 1:
            x += gap

    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def render_slide(item: dict) -> Image.Image:
    src = ROOT / item["image"]
    img = Image.open(src).convert("RGB")
    frame = cover_resize(img, W, H)
    canvas = Image.new("RGB", (W, H), BG)
    canvas.paste(frame, (0, 0))
    return render_price_bar(canvas, item.get("prices") or [])


def encode_mp4(frame_dir: Path, n_frames: int, out_path: Path) -> None:
    """One still per slide at 1/SLIDE_SEC fps → exact N × SLIDE_SEC duration."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pattern = str(frame_dir / "%03d.jpg")
    duration = n_frames * SLIDE_SEC
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        f"1/{SLIDE_SEC}",
        "-i",
        pattern,
        "-vf",
        f"fps={FPS},format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-pix_fmt",
        "yuv420p",
        "-t",
        str(duration),
        "-movflags",
        "+faststart",
        "-an",
        str(out_path),
    ]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=str(ROOT))


def main() -> int:
    slides = json.loads(SLIDES_JSON.read_text(encoding="utf-8"))
    if not slides:
        print("No slides found", file=sys.stderr)
        return 1

    work = ROOT / "assets" / "videos" / "_frames"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)

    for i, item in enumerate(slides):
        print(f"[{i + 1}/{len(slides)}] {item.get('id')}")
        frame = render_slide(item)
        out = work / f"{i:03d}.jpg"
        frame.save(out, quality=92, optimize=True)

    encode_mp4(work, len(slides), OUT_MP4)
    if "--keep-frames" not in sys.argv:
        shutil.rmtree(work, ignore_errors=True)

    size_mb = OUT_MP4.stat().st_size / (1024 * 1024)
    duration = len(slides) * SLIDE_SEC
    print(
        f"Wrote {OUT_MP4.relative_to(ROOT)} "
        f"({size_mb:.1f} MB, ~{duration}s, {len(slides)} slides × {SLIDE_SEC}s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
