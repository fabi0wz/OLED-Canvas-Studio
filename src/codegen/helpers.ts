import type { CanvasElement, DisplayConfig, FrameAnimation, ScreenTransition } from '../types';
import { BITMAP_FONTS } from '../bitmapFonts';

/** Sanitize a layer name into a valid C identifier suffix. */
export function toIdent(name: string): string {
  const cleaned = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  if (!cleaned) return 'Layer';
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

export function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Sanitize an arbitrary string into a valid C identifier. */
export function toCId(s: string): string {
  const clean = s.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(clean) ? `_${clean}` : clean;
}

/** Convert 1-bit row-major data to XBM byte array (LSB first within each byte). */
export function toXbmBytes(data: Uint8Array | number[], bmpW: number, bmpH: number): number[] {
  const rowBytes = Math.ceil(bmpW / 8);
  const out: number[] = [];
  for (let y = 0; y < bmpH; y++) {
    for (let bx = 0; bx < rowBytes; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const col = bx * 8 + bit;
        if (col < bmpW && data[y * bmpW + col]) {
          byte |= (1 << bit);
        }
      }
      out.push(byte);
    }
  }
  return out;
}

export function getU8g2Constructor(display: DisplayConfig): string {
  const t = display.type;
  if (t.startsWith('SSD1306_128x64')) return 'U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SSD1306_128x32')) return 'U8G2_SSD1306_128X32_UNIVISION_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SH1106'))         return 'U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SSD1309'))        return 'U8G2_SSD1309_128X64_NONAME2_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SSD1306_64x48'))  return 'U8G2_SSD1306_64X48_ER_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SSD1306_72x40'))  return 'U8G2_SSD1306_72X40_ER_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SH1107_128x128')) return 'U8G2_SH1107_128X128_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  if (t.startsWith('SH1107_64x128'))  return 'U8G2_SH1107_64X128_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);';
  return `U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE); // TODO: adjust for ${t}`;
}

/** Map a ScreenTransition string to the C enum value used in the runtime. */
export function transitionEnum(t: ScreenTransition): string {
  switch (t) {
    case 'instant':    return 'TRANS_INSTANT';
    case 'slideLeft':  return 'TRANS_SLIDE_LEFT';
    case 'slideRight': return 'TRANS_SLIDE_RIGHT';
    case 'slideUp':    return 'TRANS_SLIDE_UP';
    case 'slideDown':  return 'TRANS_SLIDE_DOWN';
    case 'wipeLeft':   return 'TRANS_WIPE_LEFT';
    case 'wipeRight':  return 'TRANS_WIPE_RIGHT';
    case 'fade':       return 'TRANS_FADE';
  }
}

/**
 * Compute the tight bounding box (screen coords) across all frames of an animation.
 * Width is rounded up to the nearest byte (8 px) — required by the XBM format.
 * Falls back to the full display area if no visible elements are found.
 */
export function computeAnimBoundingBox(
  animation: FrameAnimation,
  dispW: number,
  dispH: number,
): { x: number; y: number; w: number; h: number } {
  let minX = dispW, minY = dispH, maxX = 0, maxY = 0;

  function expand(el: CanvasElement): void {
    if (!el.visible) return;
    switch (el.type) {
      case 'rect':
        minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
        break;
      case 'line':
        minX = Math.min(minX, el.x, el.x2); minY = Math.min(minY, el.y, el.y2);
        maxX = Math.max(maxX, el.x + 1, el.x2 + 1); maxY = Math.max(maxY, el.y + 1, el.y2 + 1);
        break;
      case 'circle':
        minX = Math.min(minX, el.x - el.radius); minY = Math.min(minY, el.y - el.radius);
        maxX = Math.max(maxX, el.x + el.radius + 1); maxY = Math.max(maxY, el.y + el.radius + 1);
        break;
      case 'pixels':
        for (const [px, py] of el.pixels) {
          minX = Math.min(minX, el.x + px); minY = Math.min(minY, el.y + py);
          maxX = Math.max(maxX, el.x + px + 1); maxY = Math.max(maxY, el.y + py + 1);
        }
        break;
      case 'bitmap':
        minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.bmpWidth); maxY = Math.max(maxY, el.y + el.bmpHeight);
        break;
      case 'text': {
        const font = BITMAP_FONTS[el.font] ?? BITMAP_FONTS['u8g2_font_6x10_tr'];
        if (font) {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y - font.baseline);
          maxX = Math.max(maxX, el.x + el.text.length * font.width);
          maxY = Math.max(maxY, el.y - font.baseline + font.height);
        }
        break;
      }
      case 'group':
        for (const child of el.children) {
          const shifted = child.type === 'line'
            ? { ...child, x: child.x + el.x, y: child.y + el.y, x2: child.x2 + el.x, y2: child.y2 + el.y }
            : { ...child, x: child.x + el.x, y: child.y + el.y };
          expand(shifted as CanvasElement);
        }
        break;
    }
  }

  for (const frame of animation.frames) {
    for (const el of frame.elements) expand(el);
  }

  if (minX >= maxX || minY >= maxY) {
    return { x: 0, y: 0, w: dispW, h: dispH };
  }

  const x = Math.max(0, minX);
  const y = Math.max(0, minY);
  const rawW = Math.min(dispW, maxX) - x;
  const rawH = Math.min(dispH, maxY) - y;
  // Round width up to byte boundary (XBM rows must be byte-aligned)
  const w = Math.ceil(Math.max(1, rawW) / 8) * 8;
  return { x, y, w: Math.min(w, dispW - x), h: Math.max(1, rawH) };
}
