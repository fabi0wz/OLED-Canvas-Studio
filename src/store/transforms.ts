import type { CanvasElement } from '../types';
import {
  createBuffer, drawBox, drawCircle, drawDisc,
  drawFrame, drawLine, drawThickCircle, drawThickFrame, drawThickLine,
} from '../pixelEngine';

function collectPixels(buf: Uint8Array, width: number, height: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (buf[y * width + x]) out.push([x, y]);
    }
  }
  return out;
}

export function rasterizeElementToPixels(
  el: CanvasElement,
): { x: number; y: number; pixels: [number, number][] } | null {
  if (el.type === 'pixels') {
    return { x: el.x, y: el.y, pixels: el.pixels };
  }

  if (el.type === 'rect') {
    const x0 = Math.min(el.x, el.x + el.width);
    const y0 = Math.min(el.y, el.y + el.height);
    const w = Math.max(1, Math.abs(el.width));
    const h = Math.max(1, Math.abs(el.height));
    const buf = createBuffer(w, h);
    if (el.filled) drawBox(buf, w, h, 0, 0, w, h);
    else if (el.strokeWidth > 1) drawThickFrame(buf, w, h, 0, 0, w, h, el.strokeWidth);
    else drawFrame(buf, w, h, 0, 0, w, h);
    return { x: x0, y: y0, pixels: collectPixels(buf, w, h) };
  }

  if (el.type === 'line') {
    const minX = Math.min(el.x, el.x2);
    const minY = Math.min(el.y, el.y2);
    const maxX = Math.max(el.x, el.x2);
    const maxY = Math.max(el.y, el.y2);
    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);
    const x1 = el.x - minX;
    const y1 = el.y - minY;
    const x2 = el.x2 - minX;
    const y2 = el.y2 - minY;
    const buf = createBuffer(w, h);
    if (el.strokeWidth > 1) drawThickLine(buf, w, h, x1, y1, x2, y2, el.strokeWidth);
    else drawLine(buf, w, h, x1, y1, x2, y2);
    return { x: minX, y: minY, pixels: collectPixels(buf, w, h) };
  }

  if (el.type === 'circle') {
    const r = Math.max(0, Math.round(el.radius));
    const size = r * 2 + 1;
    const cx = r;
    const cy = r;
    const buf = createBuffer(size, size);
    if (el.filled) drawDisc(buf, size, size, cx, cy, r);
    else if (el.strokeWidth > 1) drawThickCircle(buf, size, size, cx, cy, r, el.strokeWidth);
    else drawCircle(buf, size, size, cx, cy, r);
    return { x: el.x - r, y: el.y - r, pixels: collectPixels(buf, size, size) };
  }

  if (el.type === 'bitmap') {
    const pixels: [number, number][] = [];
    for (let y = 0; y < el.bmpHeight; y++) {
      for (let x = 0; x < el.bmpWidth; x++) {
        if (el.data[y * el.bmpWidth + x]) pixels.push([x, y]);
      }
    }
    return { x: el.x, y: el.y, pixels };
  }

  return null;
}

function pixelsToElement(id: string, visible: boolean, abs: [number, number][]): CanvasElement {
  if (abs.length === 0) {
    return { id, type: 'pixels', x: 0, y: 0, visible, strokeWidth: 1, pixels: [] };
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of abs) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  const rel: [number, number][] = abs.map(([x, y]) => [x - minX, y - minY]);
  return { id, type: 'pixels', x: minX, y: minY, visible, strokeWidth: 1, pixels: rel };
}

function flipAbsPixels(abs: [number, number][], axis: 'h' | 'v'): [number, number][] {
  if (!abs.length) return abs;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of abs) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return abs.map(([x, y]) =>
    axis === 'h' ? [maxX - (x - minX), y] : [x, maxY - (y - minY)]
  );
}

/**
 * Lossless 90°/180°/270° rotation around the bounding-box centre.
 * Each source pixel maps to exactly one destination pixel — repeated rotations
 * are perfectly reversible.
 */
function rotateAbsPixels(abs: [number, number][], angleDeg: number): [number, number][] {
  if (!abs.length) return abs;
  const a = ((Math.round(angleDeg / 90) * 90) % 360 + 360) % 360;
  if (a === 0) return abs;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of abs) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return abs.map(([x, y]) => {
    const rx = x - minX;
    const ry = y - minY;
    if (a === 90)  return [minX + (h - 1 - ry), minY + rx] as [number, number];
    if (a === 180) return [minX + (w - 1 - rx), minY + (h - 1 - ry)] as [number, number];
    /* 270 */     return [minX + ry,           minY + (w - 1 - rx)] as [number, number];
  });
}

export function transformElement(
  el: CanvasElement,
  op: 'flip-h' | 'flip-v' | 'rotate',
  angleDeg?: number,
): CanvasElement {
  if (el.type === 'text') return el;
  if (el.type === 'circle') return el;
  if (el.type === 'rect' && (op === 'flip-h' || op === 'flip-v')) return el;

  if (el.type === 'rect' && op === 'rotate' && angleDeg !== undefined) {
    const a = ((angleDeg % 360) + 360) % 360;
    if (a === 0 || a === 180) return el;
    if (a === 90 || a === 270) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const newW = Math.abs(el.height);
      const newH = Math.abs(el.width);
      return { ...el, width: newW, height: newH, x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2) };
    }
  }

  const raster = rasterizeElementToPixels(el);
  if (!raster) return el;
  let abs: [number, number][] = raster.pixels.map(([px, py]) => [raster.x + px, raster.y + py]);
  if (op === 'flip-h') abs = flipAbsPixels(abs, 'h');
  else if (op === 'flip-v') abs = flipAbsPixels(abs, 'v');
  else if (op === 'rotate' && angleDeg !== undefined) abs = rotateAbsPixels(abs, angleDeg);
  return pixelsToElement(el.id, el.visible, abs);
}

export function resizeElement(
  el: CanvasElement,
  nxIn: number, nyIn: number, nwIn: number, nhIn: number,
): CanvasElement {
  const nw = Math.max(1, Math.round(nwIn));
  const nh = Math.max(1, Math.round(nhIn));
  const nx = Math.round(nxIn);
  const ny = Math.round(nyIn);

  if (el.type === 'rect') return { ...el, x: nx, y: ny, width: nw, height: nh };

  if (el.type === 'circle') {
    const r = Math.max(1, Math.round(Math.max(nw, nh) / 2));
    return { ...el, radius: r };
  }

  if (el.type === 'line') {
    const minX = Math.min(el.x, el.x2);
    const maxX = Math.max(el.x, el.x2);
    const minY = Math.min(el.y, el.y2);
    const maxY = Math.max(el.y, el.y2);
    const oW = Math.max(1, maxX - minX);
    const oH = Math.max(1, maxY - minY);
    const remap = (x: number, y: number): [number, number] => [
      Math.round(nx + ((x - minX) * nw) / oW),
      Math.round(ny + ((y - minY) * nh) / oH),
    ];
    const [a1, b1] = remap(el.x, el.y);
    const [a2, b2] = remap(el.x2, el.y2);
    return { ...el, x: a1, y: b1, x2: a2, y2: b2 };
  }

  // Pixels, text, bitmap — translate only (no resampling).
  return { ...el, x: nx, y: ny };
}
