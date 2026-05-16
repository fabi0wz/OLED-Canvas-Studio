/**
 * Pixel-accurate rendering algorithms matching U8g2's internal implementations.
 * All drawing is done to a 1-bit pixel buffer, then rendered to the canvas.
 * This ensures the preview matches exactly what the OLED will display.
 */

export type PixelBuffer = Uint8Array;

export function createBuffer(w: number, h: number): PixelBuffer {
  return new Uint8Array(w * h);
}

export function setPixel(buf: PixelBuffer, w: number, h: number, x: number, y: number) {
  if (x >= 0 && x < w && y >= 0 && y < h) {
    buf[y * w + x] = 1;
  }
}

export function clearPixel(buf: PixelBuffer, w: number, h: number, x: number, y: number) {
  if (x >= 0 && x < w && y >= 0 && y < h) {
    buf[y * w + x] = 0;
  }
}

/**
 * Bresenham's line algorithm — matches U8g2 u8g2_DrawLine
 */
export function drawLine(buf: PixelBuffer, w: number, h: number, x0: number, y0: number, x1: number, y1: number) {
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    setPixel(buf, w, h, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/**
 * Thick line — draw parallel Bresenham lines offset perpendicular to the line direction
 */
export function drawThickLine(buf: PixelBuffer, w: number, h: number, x0: number, y0: number, x1: number, y1: number, thickness: number) {
  if (thickness <= 1) {
    drawLine(buf, w, h, x0, y0, x1, y1);
    return;
  }
  // For each offset from -(t-1)/2 to +(t-1)/2, draw offset lines
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    setPixel(buf, w, h, x0, y0);
    return;
  }
  // Perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;
  const half = (thickness - 1) / 2;
  for (let i = -Math.floor(half); i <= Math.ceil(half); i++) {
    const ox = Math.round(px * i);
    const oy = Math.round(py * i);
    drawLine(buf, w, h, x0 + ox, y0 + oy, x1 + ox, y1 + oy);
  }
}

/**
 * Rectangle outline — matches U8g2 u8g2_DrawFrame
 */
export function drawFrame(buf: PixelBuffer, w: number, h: number, x: number, y: number, rw: number, rh: number) {
  // Top and bottom horizontal lines
  for (let i = 0; i < rw; i++) {
    setPixel(buf, w, h, x + i, y);
    setPixel(buf, w, h, x + i, y + rh - 1);
  }
  // Left and right vertical lines
  for (let j = 0; j < rh; j++) {
    setPixel(buf, w, h, x, y + j);
    setPixel(buf, w, h, x + rw - 1, y + j);
  }
}

/**
 * Thick rectangle outline
 */
export function drawThickFrame(buf: PixelBuffer, w: number, h: number, x: number, y: number, rw: number, rh: number, thickness: number) {
  for (let t = 0; t < thickness; t++) {
    drawFrame(buf, w, h, x + t, y + t, rw - 2 * t, rh - 2 * t);
  }
}

/**
 * Filled rectangle — matches U8g2 u8g2_DrawBox
 */
export function drawBox(buf: PixelBuffer, w: number, h: number, x: number, y: number, rw: number, rh: number) {
  for (let j = 0; j < rh; j++) {
    for (let i = 0; i < rw; i++) {
      setPixel(buf, w, h, x + i, y + j);
    }
  }
}

/**
 * Midpoint circle algorithm — matches U8g2 u8g2_DrawCircle
 * U8g2 draws all 8 octants using the standard midpoint algorithm.
 */
export function drawCircle(buf: PixelBuffer, w: number, h: number, cx: number, cy: number, r: number) {
  let x = r;
  let y = 0;
  let d = 1 - r;

  while (x >= y) {
    // All 8 octant points
    setPixel(buf, w, h, cx + x, cy + y);
    setPixel(buf, w, h, cx - x, cy + y);
    setPixel(buf, w, h, cx + x, cy - y);
    setPixel(buf, w, h, cx - x, cy - y);
    setPixel(buf, w, h, cx + y, cy + x);
    setPixel(buf, w, h, cx - y, cy + x);
    setPixel(buf, w, h, cx + y, cy - x);
    setPixel(buf, w, h, cx - y, cy - x);

    y++;
    if (d < 0) {
      d += 2 * y + 1;
    } else {
      x--;
      d += 2 * (y - x) + 1;
    }
  }
}

/**
 * Thick circle outline — draw concentric circles for each radius in range
 */
export function drawThickCircle(buf: PixelBuffer, w: number, h: number, cx: number, cy: number, r: number, thickness: number) {
  if (thickness <= 1) {
    drawCircle(buf, w, h, cx, cy, r);
    return;
  }
  // Draw circles from r down to r - thickness + 1
  for (let t = 0; t < thickness; t++) {
    const cr = r - t;
    if (cr >= 0) {
      drawCircle(buf, w, h, cx, cy, cr);
    }
  }
}

/**
 * Filled circle (disc) — matches U8g2 u8g2_DrawDisc
 * Uses midpoint algorithm and fills horizontal spans.
 */
export function drawDisc(buf: PixelBuffer, w: number, h: number, cx: number, cy: number, r: number) {
  let x = r;
  let y = 0;
  let d = 1 - r;

  while (x >= y) {
    // Fill horizontal lines for each pair of octant points
    for (let i = cx - x; i <= cx + x; i++) {
      setPixel(buf, w, h, i, cy + y);
      setPixel(buf, w, h, i, cy - y);
    }
    for (let i = cx - y; i <= cx + y; i++) {
      setPixel(buf, w, h, i, cy + x);
      setPixel(buf, w, h, i, cy - x);
    }

    y++;
    if (d < 0) {
      d += 2 * y + 1;
    } else {
      x--;
      d += 2 * (y - x) + 1;
    }
  }
}

/**
 * Render the 1-bit pixel buffer onto a canvas context.
 * Each pixel becomes a zoom×zoom square.
 */
export function renderBuffer(
  ctx: CanvasRenderingContext2D,
  buf: PixelBuffer,
  bufW: number,
  bufH: number,
  zoom: number,
  color: string = '#fff'
) {
  ctx.fillStyle = color;
  for (let y = 0; y < bufH; y++) {
    for (let x = 0; x < bufW; x++) {
      if (buf[y * bufW + x]) {
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }
  }
}
