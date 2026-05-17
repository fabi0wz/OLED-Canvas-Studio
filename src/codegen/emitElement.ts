import type { CanvasElement } from '../types';
import { escapeStr, toCId } from './helpers';

/** Emit drawing calls for a single element into `out`, indented two spaces. */
export function emitElement(out: string[], el: CanvasElement, lastFontRef: { font: string }): void {
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
      const placeholderRe = /\{(\w+)\}/g;
      const hasPlaceholders = placeholderRe.test(el.text);
      if (hasPlaceholders) {
        const fmtStr = el.text.replace(/\{(\w+)\}/g, '%s');
        const vars = [...el.text.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
        out.push(`  // Live data: ${vars.join(', ')}`);
        const varName = `buf_${el.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        out.push(`  char ${varName}[64];`);
        out.push(`  snprintf(${varName}, sizeof(${varName}), "${escapeStr(fmtStr)}", ${vars.join(', ')});`);
        out.push(`  u8g2.drawStr(${el.x}, ${el.y}, ${varName});`);
      } else {
        out.push(`  u8g2.drawStr(${el.x}, ${el.y}, "${escapeStr(el.text)}");`);
      }
      if (inv) {
        out.push(`  u8g2.setDrawColor(1);`);
        out.push(`  u8g2.setFontMode(0);`);
      }
      break;
    }
    case 'rect': {
      const inv = !!el.inverted;
      if (inv) out.push(`  u8g2.setDrawColor(0);`);
      if (el.filled) out.push(`  u8g2.drawBox(${el.x}, ${el.y}, ${el.width}, ${el.height});`);
      else out.push(`  u8g2.drawFrame(${el.x}, ${el.y}, ${el.width}, ${el.height});`);
      if (inv) out.push(`  u8g2.setDrawColor(1);`);
      break;
    }
    case 'line': {
      const inv = !!el.inverted;
      if (inv) out.push(`  u8g2.setDrawColor(0);`);
      out.push(`  u8g2.drawLine(${el.x}, ${el.y}, ${el.x2}, ${el.y2});`);
      if (inv) out.push(`  u8g2.setDrawColor(1);`);
      break;
    }
    case 'circle': {
      const inv = !!el.inverted;
      if (inv) out.push(`  u8g2.setDrawColor(0);`);
      if (el.filled) out.push(`  u8g2.drawDisc(${el.x}, ${el.y}, ${el.radius});`);
      else out.push(`  u8g2.drawCircle(${el.x}, ${el.y}, ${el.radius});`);
      if (inv) out.push(`  u8g2.setDrawColor(1);`);
      break;
    }
    case 'pixels': {
      if (el.inverted) out.push(`  u8g2.setDrawColor(0);`);
      // Group pixels by row, sort by x, then merge consecutive x into drawHLine runs
      const byRow = new Map<number, number[]>();
      for (const [px, py] of el.pixels) {
        const row = el.y + py;
        const col = el.x + px;
        let cols = byRow.get(row);
        if (!cols) { cols = []; byRow.set(row, cols); }
        cols.push(col);
      }
      for (const [row, rawCols] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
        const cols = [...new Set(rawCols)].sort((a, b) => a - b);
        let i = 0;
        while (i < cols.length) {
          let j = i;
          while (j + 1 < cols.length && cols[j + 1] === cols[j] + 1) j++;
          const run = j - i + 1;
          if (run === 1) out.push(`  u8g2.drawPixel(${cols[i]}, ${row});`);
          else out.push(`  u8g2.drawHLine(${cols[i]}, ${row}, ${run});`);
          i = j + 1;
        }
      }
      if (el.inverted) out.push(`  u8g2.setDrawColor(1);`);
      break;
    }
    case 'group':
      out.push(`  // Group`);
      for (const child of el.children) {
        const shifted = child.type === 'line'
          ? { ...child, x: child.x + el.x, y: child.y + el.y, x2: child.x2 + el.x, y2: child.y2 + el.y }
          : { ...child, x: child.x + el.x, y: child.y + el.y };
        emitElement(out, shifted as import('../types').CanvasElement, lastFontRef);
      }
      break;
    case 'bitmap': {
      const varName = `bmp_${el.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      out.push(`  u8g2.drawXBMP(${el.x}, ${el.y}, ${el.bmpWidth}, ${el.bmpHeight}, ${varName});`);
      break;
    }
    case 'animationRef':
      out.push(`  drawAnim_${toCId(el.animationId)}();`);
      break;
    case 'widgetRef':
      out.push(`  drawWidget_${toCId(el.widgetId)}();`);
      break;
  }
}
