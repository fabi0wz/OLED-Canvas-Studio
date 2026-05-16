import type { PixelBuffer } from '../pixelEngine';
import { setPixel } from '../pixelEngine';
import { BITMAP_FONTS } from '../bitmapFonts';
import type { ProceduralWidget } from '../types';
import { FONT_METRICS } from '../types';

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function normalize(v: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp01((v - min) / (max - min));
}

/** Resolve the effective preview value for a widget. */
export function getWidgetPreviewValue(w: ProceduralWidget): number {
  if (w.valueSource === 'time') {
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }
  return w.simValue;
}

/** Format a clock string from H/M/S tokens. */
export function formatClock(fmt: string, d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return fmt
    .replace(/HH/g, pad(d.getHours()))
    .replace(/H/g,  d.getHours().toString())
    .replace(/MM/g, pad(d.getMinutes()))
    .replace(/M/g,  d.getMinutes().toString())
    .replace(/SS/g, pad(d.getSeconds()))
    .replace(/S/g,  d.getSeconds().toString());
}

/** Render bitmap-font text into a pixel buffer. */
export function drawText(
  buf: PixelBuffer, dispW: number, dispH: number,
  font: string, x: number, baselineY: number, text: string,
): void {
  const f = BITMAP_FONTS[font] || BITMAP_FONTS['u8g2_font_6x10_tr'];
  if (!f) return;
  const metrics = FONT_METRICS[font] || { width: f.width, height: f.height };
  const ty = baselineY - f.baseline;
  for (let ci = 0; ci < text.length; ci++) {
    const glyph = f.glyphs[text.charCodeAt(ci)] || f.glyphs[63];
    if (!glyph) continue;
    for (let row = 0; row < glyph.length; row++) {
      const bits = glyph[row];
      for (let col = 0; col < f.width; col++) {
        if (bits & (1 << (f.width - 1 - col))) {
          setPixel(buf, dispW, dispH, x + ci * metrics.width + col, ty + row);
        }
      }
    }
  }
}
