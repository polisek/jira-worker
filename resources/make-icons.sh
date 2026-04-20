#!/bin/bash
# usage: ./make-electron-icons.sh input.png
# Vyžaduje: brew install imagemagick

INPUT="${1:-icon.png}"
BASE="${INPUT%.*}"
OUT_DIR="./"

mkdir -p "$OUT_DIR" "${BASE}.iconset"

echo "🔧 Generuji ikony z: $INPUT"

# ── Linux ──────────────────────────────────────────────
magick "$INPUT" -resize 512x512 "$OUT_DIR/icon.png"
echo "✅ Linux:   icon.png (512×512)"

# ── Windows ICO ────────────────────────────────────────
magick "$INPUT" \
  \( -clone 0 -resize 16x16   \) \
  \( -clone 0 -resize 24x24   \) \
  \( -clone 0 -resize 32x32   \) \
  \( -clone 0 -resize 48x48   \) \
  \( -clone 0 -resize 64x64   \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 "$OUT_DIR/icon.ico"
echo "✅ Windows: icon.ico (16–256)"

# ── macOS ICNS (přes iconutil) ─────────────────────────
ICONSET="${BASE}.iconset"

magick "$INPUT" -resize 16x16    "$ICONSET/icon_16x16.png"
magick "$INPUT" -resize 32x32    "$ICONSET/icon_16x16@2x.png"
magick "$INPUT" -resize 32x32    "$ICONSET/icon_32x32.png"
magick "$INPUT" -resize 64x64    "$ICONSET/icon_32x32@2x.png"
magick "$INPUT" -resize 128x128  "$ICONSET/icon_128x128.png"
magick "$INPUT" -resize 256x256  "$ICONSET/icon_128x128@2x.png"
magick "$INPUT" -resize 256x256  "$ICONSET/icon_256x256.png"
magick "$INPUT" -resize 512x512  "$ICONSET/icon_256x256@2x.png"
magick "$INPUT" -resize 512x512  "$ICONSET/icon_512x512.png"
magick "$INPUT" -resize 1024x1024 "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$OUT_DIR/icon.icns"
rm -rf "$ICONSET"
echo "✅ macOS:   icon.icns"

echo ""
echo "📁 Výsledek v: $OUT_DIR/"
ls -lh "$OUT_DIR/"