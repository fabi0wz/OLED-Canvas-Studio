import type { CanvasElement, FrameAnimation, ProceduralWidget } from '../../types';
import { FONT_METRICS } from '../../types';
import {
  createBuffer, setPixel, clearPixel,
  drawLine, drawThickLine,
  drawFrame, drawThickFrame, drawBox,
  drawCircle, drawThickCircle, drawDisc,
} from '../../pixelEngine';
import { BITMAP_FONTS, type BitmapFont } from '../../bitmapFonts';
import { renderWidget } from '../../widgets';

export interface RenderLookups {
  animations: FrameAnimation[];
  widgets: ProceduralWidget[];
  activeFrameId: string | null;
}

/** Render a single CanvasElement into the given 1-bit buffer. */
export function renderElementIntoBuffer(
  buf: Uint8Array,
  dispW: number,
  dispH: number,
  el: CanvasElement,
  lookups?: RenderLookups,
): void {
  if (!el.visible) return;

  if (el.type === 'animationRef') {
    if (!lookups) return;
    const anim = lookups.animations.find((a) => a.id === el.animationId);
    if (!anim || !anim.visible || anim.frames.length === 0) return;
    const frame = anim.frames.find((f) => f.id === lookups.activeFrameId) ?? anim.frames[0];
    for (const child of frame.elements) {
      renderElementIntoBuffer(buf, dispW, dispH, child, lookups);
    }
    return;
  }

  if (el.type === 'widgetRef') {
    if (!lookups) return;
    const wgt = lookups.widgets.find((w) => w.id === el.widgetId);
    if (!wgt || !wgt.visible) return;
    renderWidget(buf, dispW, dispH, wgt);
    return;
  }

  const sw = el.strokeWidth || 1;

  switch (el.type) {
    case 'text': {
      const font: BitmapFont = BITMAP_FONTS[el.font] || BITMAP_FONTS['u8g2_font_6x10_tr'];
      if (!font) return;
      const metrics = FONT_METRICS[el.font] || { width: font.width, height: font.height };
      const tx = el.x;
      const ty = el.y - font.baseline;
      const writer = el.inverted ? clearPixel : setPixel;
      for (let ci = 0; ci < el.text.length; ci++) {
        const code = el.text.charCodeAt(ci);
        const glyph = font.glyphs[code] || font.glyphs[63];
        if (!glyph) continue;
        for (let row = 0; row < glyph.length; row++) {
          const bits = glyph[row];
          for (let col = 0; col < font.width; col++) {
            if (bits & (1 << (font.width - 1 - col))) {
              writer(buf, dispW, dispH, tx + ci * metrics.width + col, ty + row);
            }
          }
        }
      }
      return;
    }
    case 'rect': {
      if (el.inverted) {
        const tw = Math.max(1, el.width);
        const th = Math.max(1, el.height);
        const tmp = createBuffer(tw, th);
        if (el.filled) drawBox(tmp, tw, th, 0, 0, tw, th);
        else if (sw > 1) drawThickFrame(tmp, tw, th, 0, 0, tw, th, sw);
        else drawFrame(tmp, tw, th, 0, 0, tw, th);
        for (let row = 0; row < th; row++)
          for (let col = 0; col < tw; col++)
            if (tmp[row * tw + col]) clearPixel(buf, dispW, dispH, el.x + col, el.y + row);
      } else {
        if (el.filled) drawBox(buf, dispW, dispH, el.x, el.y, el.width, el.height);
        else if (sw > 1) drawThickFrame(buf, dispW, dispH, el.x, el.y, el.width, el.height, sw);
        else drawFrame(buf, dispW, dispH, el.x, el.y, el.width, el.height);
      }
      return;
    }
    case 'line': {
      if (el.inverted) {
        const minX = Math.min(el.x, el.x2);
        const minY = Math.min(el.y, el.y2);
        const maxX = Math.max(el.x, el.x2);
        const maxY = Math.max(el.y, el.y2);
        const tw = Math.max(1, maxX - minX + 1);
        const th = Math.max(1, maxY - minY + 1);
        const tmp = createBuffer(tw, th);
        if (sw > 1) drawThickLine(tmp, tw, th, el.x - minX, el.y - minY, el.x2 - minX, el.y2 - minY, sw);
        else drawLine(tmp, tw, th, el.x - minX, el.y - minY, el.x2 - minX, el.y2 - minY);
        for (let row = 0; row < th; row++)
          for (let col = 0; col < tw; col++)
            if (tmp[row * tw + col]) clearPixel(buf, dispW, dispH, minX + col, minY + row);
      } else {
        if (sw > 1) drawThickLine(buf, dispW, dispH, el.x, el.y, el.x2, el.y2, sw);
        else drawLine(buf, dispW, dispH, el.x, el.y, el.x2, el.y2);
      }
      return;
    }
    case 'circle': {
      if (el.inverted) {
        const r = Math.max(0, Math.round(el.radius));
        const size = r * 2 + 1;
        const tmp = createBuffer(size, size);
        if (el.filled) drawDisc(tmp, size, size, r, r, r);
        else if (sw > 1) drawThickCircle(tmp, size, size, r, r, r, sw);
        else drawCircle(tmp, size, size, r, r, r);
        for (let row = 0; row < size; row++)
          for (let col = 0; col < size; col++)
            if (tmp[row * size + col]) clearPixel(buf, dispW, dispH, el.x - r + col, el.y - r + row);
      } else {
        if (el.filled) drawDisc(buf, dispW, dispH, el.x, el.y, el.radius);
        else if (sw > 1) drawThickCircle(buf, dispW, dispH, el.x, el.y, el.radius, sw);
        else drawCircle(buf, dispW, dispH, el.x, el.y, el.radius);
      }
      return;
    }
    case 'pixels': {
      if (el.inverted) {
        for (const [px, py] of el.pixels) {
          clearPixel(buf, dispW, dispH, el.x + px, el.y + py);
        }
      } else {
        for (const [px, py] of el.pixels) {
          setPixel(buf, dispW, dispH, el.x + px, el.y + py);
        }
      }
      return;
    }
    case 'group': {
      for (const child of el.children) {
        const shifted = child.type === 'line'
          ? { ...child, x: child.x + el.x, y: child.y + el.y, x2: child.x2 + el.x, y2: child.y2 + el.y }
          : { ...child, x: child.x + el.x, y: child.y + el.y };
        renderElementIntoBuffer(buf, dispW, dispH, shifted as import('../../types').CanvasElement, lookups);
      }
      return;
    }
    case 'bitmap': {
      for (let row = 0; row < el.bmpHeight; row++) {
        for (let col = 0; col < el.bmpWidth; col++) {
          if (el.data[row * el.bmpWidth + col]) {
            setPixel(buf, dispW, dispH, el.x + col, el.y + row);
          }
        }
      }
      return;
    }
  }
}
