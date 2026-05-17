import type { CanvasElement } from '../types';
import {
  createBuffer, drawBox, drawFrame, drawThickFrame,
  drawLine, drawThickLine, drawCircle, drawThickCircle, drawDisc,
  setPixel,
} from '../pixelEngine';
import { BITMAP_FONTS } from '../bitmapFonts';

/** Render an element list into a 1-bit packed buffer (row-major).
 *  ox/oy: subtract this origin from all element coordinates before drawing,
 *  so elements that live at screen position (ox, oy) map to pixel (0,0) in the buffer.
 */
export function rasterizeElementsToBitmap(
  elements: CanvasElement[], width: number, height: number,
  ox = 0, oy = 0,
): Uint8Array {
  const buf = createBuffer(width, height);
  for (const el of elements) {
    if (!el.visible) continue;
    const sw = el.strokeWidth || 1;
    const ex = el.x - ox;
    const ey = el.y - oy;
    switch (el.type) {
      case 'rect':
        if (el.filled) drawBox(buf, width, height, ex, ey, el.width, el.height);
        else if (sw > 1) drawThickFrame(buf, width, height, ex, ey, el.width, el.height, sw);
        else drawFrame(buf, width, height, ex, ey, el.width, el.height);
        break;
      case 'line': {
        const ex2 = el.x2 - ox, ey2 = el.y2 - oy;
        if (sw > 1) drawThickLine(buf, width, height, ex, ey, ex2, ey2, sw);
        else drawLine(buf, width, height, ex, ey, ex2, ey2);
        break;
      }
      case 'circle':
        if (el.filled) drawDisc(buf, width, height, ex, ey, el.radius);
        else if (sw > 1) drawThickCircle(buf, width, height, ex, ey, el.radius, sw);
        else drawCircle(buf, width, height, ex, ey, el.radius);
        break;
      case 'pixels':
        for (const [px, py] of el.pixels) setPixel(buf, width, height, ex + px, ey + py);
        break;
      case 'bitmap':
        for (let r = 0; r < el.bmpHeight; r++)
          for (let c = 0; c < el.bmpWidth; c++)
            if (el.data[r * el.bmpWidth + c]) setPixel(buf, width, height, ex + c, ey + r);
        break;
      case 'text': {
        const font = BITMAP_FONTS[el.font] || BITMAP_FONTS['u8g2_font_6x10_tr'];
        if (!font) break;
        const ty = ey - font.baseline;
        for (let ci = 0; ci < el.text.length; ci++) {
          const code = el.text.charCodeAt(ci);
          const glyph = font.glyphs[code] || font.glyphs[63];
          if (!glyph) continue;
          for (let row = 0; row < glyph.length; row++) {
            const bits = glyph[row];
            for (let col = 0; col < font.width; col++) {
              if (bits & (1 << (font.width - 1 - col))) setPixel(buf, width, height, ex + ci * font.width + col, ty + row);
            }
          }
        }
        break;
      }
      case 'group': {
        const absChildren = el.children.map((c: import('../types').CanvasElement) => {
          if (c.type === 'line') return { ...c, x: c.x + el.x, y: c.y + el.y, x2: c.x2 + el.x, y2: c.y2 + el.y };
          return { ...c, x: c.x + el.x, y: c.y + el.y };
        }) as import('../types').CanvasElement[];
        const inner = rasterizeElementsToBitmap(absChildren, width, height, ox, oy);
        for (let i = 0; i < inner.length; i++) { if (inner[i]) buf[i] = 1; }
        break;
      }
    }
  }
  return buf;
}
