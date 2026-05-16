import type { DisplayConfig, ScreenTransition } from '../types';

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
