import type { CanvasElement, BitmapElement, DisplayConfig, Layer } from './types';

/**
 * Sanitize a layer name into a valid C identifier suffix.
 * "Top Bar" -> "TopBar", "battery!" -> "Battery", "1stRow" -> "_1stRow"
 */
function toIdent(name: string): string {
  const cleaned = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  if (!cleaned) return 'Layer';
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Emit drawing calls for a single element into `out`, indented two spaces. */
function emitElement(out: string[], el: CanvasElement, lastFontRef: { font: string }) {
  switch (el.type) {
    case 'text': {
      const inv = !!el.inverted;
      if (inv) {
        out.push(`  u8g2.setFontMode(1);`);
        out.push(`  u8g2.setDrawColor(0);`);
      }
      if (el.font !== lastFontRef.font) {
        out.push(`  u8g2.setFont(${el.font});`);
        lastFontRef.font = el.font;
      }
      // Detect live-data placeholders like {temp}, {time}, {humidity}
      const placeholderRe = /\{(\w+)\}/g;
      const hasPlaceholders = placeholderRe.test(el.text);
      if (hasPlaceholders) {
        // Generate a sprintf-based dynamic string
        const fmtStr = el.text.replace(/\{(\w+)\}/g, '%s');
        const vars = [...el.text.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
        out.push(`  // Live data: ${vars.join(', ')}`);
        out.push(`  char buf_${el.id.replace(/[^a-zA-Z0-9]/g, '_')}[64];`);
        const varName = `buf_${el.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        out.push(`  snprintf(${varName}, sizeof(${varName}), "${escapeStr(fmtStr)}", ${vars.join(', ')});`);
        out.push(`  u8g2.drawStr(${el.x}, ${el.y}, ${varName});`);
      } else {
        const s = escapeStr(el.text);
        out.push(`  u8g2.drawStr(${el.x}, ${el.y}, "${s}");`);
      }
      if (inv) {
        out.push(`  u8g2.setDrawColor(1);`);
        out.push(`  u8g2.setFontMode(0);`);
      }
      break;
    }
    case 'rect': {
      const inv = !!el.inverted;
      if (inv) {
        out.push(`  u8g2.setDrawColor(0);`);
      }
      if (el.filled) {
        out.push(`  u8g2.drawBox(${el.x}, ${el.y}, ${el.width}, ${el.height});`);
      } else {
        out.push(`  u8g2.drawFrame(${el.x}, ${el.y}, ${el.width}, ${el.height});`);
      }
      if (inv) {
        out.push(`  u8g2.setDrawColor(1);`);
      }
      break;
    }
    case 'line': {
      const inv = !!el.inverted;
      if (inv) {
        out.push(`  u8g2.setDrawColor(0);`);
      }
      out.push(`  u8g2.drawLine(${el.x}, ${el.y}, ${el.x2}, ${el.y2});`);
      if (inv) {
        out.push(`  u8g2.setDrawColor(1);`);
      }
      break;
    }
    case 'circle': {
      const inv = !!el.inverted;
      if (inv) {
        out.push(`  u8g2.setDrawColor(0);`);
      }
      if (el.filled) out.push(`  u8g2.drawDisc(${el.x}, ${el.y}, ${el.radius});`);
      else           out.push(`  u8g2.drawCircle(${el.x}, ${el.y}, ${el.radius});`);
      if (inv) {
        out.push(`  u8g2.setDrawColor(1);`);
      }
      break;
    }
    case 'pixels':
      for (const [px, py] of el.pixels) {
        out.push(`  u8g2.drawPixel(${el.x + px}, ${el.y + py});`);
      }
      break;
    case 'bitmap': {
      // Emit as a PROGMEM XBM array reference. The bitmap data array is
      // generated separately above the layer functions.
      const varName = `bmp_${el.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      out.push(`  u8g2.drawXBMP(${el.x}, ${el.y}, ${el.bmpWidth}, ${el.bmpHeight}, ${varName});`);
      break;
    }
  }
}

function getU8g2Constructor(display: DisplayConfig): string {
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

/** Convert 1-bit row-major data to XBM byte array (LSB first within each byte). */
function toXbmBytes(data: Uint8Array | number[], bmpW: number, bmpH: number): number[] {
  const rowBytes = Math.ceil(bmpW / 8);
  const out: number[] = [];
  for (let y = 0; y < bmpH; y++) {
    for (let bx = 0; bx < rowBytes; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const col = bx * 8 + bit;
        if (col < bmpW && data[y * bmpW + col]) {
          byte |= (1 << bit); // XBM is LSB-first
        }
      }
      out.push(byte);
    }
  }
  return out;
}

export interface CodegenOptions {
  display: DisplayConfig;
  layers: Layer[];
  erasedPixels?: [number, number][];
}

export function generateU8g2Code(opts: CodegenOptions): string {
  const { display, layers, erasedPixels = [] } = opts;
  const lines: string[] = [];

  lines.push('// =============================================================');
  lines.push('//  Generated by OLED Canvas Studio');
  lines.push(`//  Display: ${display.type} ${display.width}x${display.height}`);
  lines.push(`//  Layers : ${layers.length}`);
  lines.push('// =============================================================');
  lines.push('');
  lines.push('#include <Arduino.h>');
  lines.push('#include <U8g2lib.h>');
  lines.push('#include <Wire.h>');
  lines.push('');
  lines.push('// --- Display constructor ------------------------------------');
  lines.push('// Adjust constructor / pins for your specific board & wiring.');
  lines.push(getU8g2Constructor(display));
  lines.push('');

  // Emit PROGMEM bitmap arrays for any BitmapElement
  const bitmapEls: BitmapElement[] = [];
  for (const l of layers) {
    for (const el of l.elements) {
      if (el.type === 'bitmap' && el.visible) bitmapEls.push(el);
    }
  }
  if (bitmapEls.length > 0) {
    lines.push('// --- Bitmap data -------------------------------------------');
    for (const bmp of bitmapEls) {
      const varName = `bmp_${bmp.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const bytes = toXbmBytes(bmp.data, bmp.bmpWidth, bmp.bmpHeight);
      lines.push(`static const unsigned char ${varName}[] PROGMEM = {`);
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += 12) {
        chunks.push('  ' + bytes.slice(i, i + 12).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', '));
      }
      lines.push(chunks.join(',\n'));
      lines.push('};');
      lines.push('');
    }
  }

  // Collect live-data placeholder variables used across all text elements
  const placeholderVars = new Set<string>();
  for (const l of layers) {
    for (const el of l.elements) {
      if (el.type === 'text' && el.visible) {
        const matches = el.text.matchAll(/\{(\w+)\}/g);
        for (const m of matches) placeholderVars.add(m[1]);
      }
    }
  }
  if (placeholderVars.size > 0) {
    lines.push('// --- Live data variables -----------------------------------');
    lines.push('// Update these before calling drawLayout() to show live values.');
    for (const v of placeholderVars) {
      lines.push(`const char* ${v} = "---";`);
    }
    lines.push('');
  }

  // De-duplicate identifier collisions like two layers both called "main"
  const usedIdents = new Set<string>();
  const layerFnNames: string[] = layers.map((l) => {
    let base = `draw${toIdent(l.name)}`;
    let name = base;
    let i = 2;
    while (usedIdents.has(name)) name = `${base}${i++}`;
    usedIdents.add(name);
    return name;
  });

  // Emit one function per layer (in order — first declared = bottom-most drawn first)
  lines.push('// --- Layer functions ----------------------------------------');
  layers.forEach((layer, idx) => {
    const fnName = layerFnNames[idx];
    const visibleEls = layer.elements.filter((e) => e.visible);

    lines.push('');
    lines.push(`/** Layer: "${layer.name}" — ${visibleEls.length} element(s)${layer.visible ? '' : '  [HIDDEN]'} */`);
    lines.push(`void ${fnName}() {`);
    if (visibleEls.length === 0) {
      lines.push('  // (empty)');
    } else {
      const fontRef = { font: '' };
      for (const el of visibleEls) emitElement(lines, el, fontRef);
    }
    lines.push('}');
  });

  // Eraser mask helper (only emitted if there are erased pixels)
  if (erasedPixels.length > 0) {
    lines.push('');
    lines.push('/** User-erased pixels — applied last to subtract from final buffer. */');
    lines.push('void applyEraserMask() {');
    lines.push('  u8g2.setDrawColor(0);');
    for (const [x, y] of erasedPixels) {
      lines.push(`  u8g2.drawPixel(${x}, ${y});`);
    }
    lines.push('  u8g2.setDrawColor(1);');
    lines.push('}');
  }

  // Master drawLayout
  lines.push('');
  lines.push('// --- Compose the full frame ---------------------------------');
  lines.push('void drawLayout() {');
  lines.push('  u8g2.clearBuffer();');
  layers.forEach((layer, idx) => {
    if (!layer.visible) {
      lines.push(`  // ${layerFnNames[idx]}();  // [layer hidden]`);
    } else {
      lines.push(`  ${layerFnNames[idx]}();`);
    }
  });
  if (erasedPixels.length > 0) {
    lines.push('  applyEraserMask();');
  }
  lines.push('  u8g2.sendBuffer();');
  lines.push('}');

  lines.push('');
  lines.push('void setup() {');
  lines.push('  u8g2.begin();');
  lines.push('  drawLayout();');
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  lines.push('  // Static layout — call drawLayout() again to refresh.');
  lines.push('}');

  return lines.join('\n');
}
