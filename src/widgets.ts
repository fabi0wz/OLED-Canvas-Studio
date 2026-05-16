/**
 * Procedural widget definitions: live preview rendering (into the same 1-bit
 * buffer used by the rest of the editor) and C++ code emission.
 *
 * Each widget receives a numeric value (or a Date) — the editor uses the
 * widget's `simValue`/current time for preview, and the generated code uses
 * either a live variable, a sim constant, or millis()-derived time.
 */
import type {
  ProceduralWidget, AnalogClockWidget, DigitalClockWidget,
  ProgressBarWidget, MeterWidget, GaugeWidget,
  BatteryWidget,
} from './types';
import { FONT_METRICS } from './types';
import {
  type PixelBuffer,
  drawCircle, drawLine, drawFrame, drawBox, setPixel,
} from './pixelEngine';
import { BITMAP_FONTS } from './bitmapFonts';

/* ============================================================
   Preview rendering
   ============================================================ */

/** Resolve the effective preview value for a widget. */
export function getWidgetPreviewValue(w: ProceduralWidget): number {
  if (w.valueSource === 'time') {
    // Use current seconds-since-midnight as a generic time-like number.
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }
  return w.simValue;
}

/** Bounding box of the widget in display-pixel coordinates. */
export function getWidgetBounds(w: ProceduralWidget): { x: number; y: number; w: number; h: number } {
  switch (w.type) {
    case 'analogClock':
    case 'gauge': {
      const r = (w as AnalogClockWidget | GaugeWidget).radius;
      return { x: w.x - r, y: w.y - r, w: r * 2 + 1, h: r * 2 + 1 };
    }
    case 'digitalClock': {
      const dw = w as DigitalClockWidget;
      const metrics = FONT_METRICS[dw.font] || { width: 6, height: 10 };
      const txt = formatClock(dw.format, new Date());
      return { x: w.x, y: w.y - metrics.height, w: Math.max(1, txt.length * metrics.width), h: metrics.height };
    }
    default: {
      const dw = w as ProgressBarWidget | MeterWidget | BatteryWidget;
      return { x: dw.x, y: dw.y, w: dw.width, h: dw.height };
    }
  }
}

export function renderWidget(
  buf: PixelBuffer, dispW: number, dispH: number,
  w: ProceduralWidget,
): void {
  switch (w.type) {
    case 'analogClock':  return renderAnalogClock(buf, dispW, dispH, w);
    case 'digitalClock': return renderDigitalClock(buf, dispW, dispH, w);
    case 'progressBar':  return renderProgressBar(buf, dispW, dispH, w);
    case 'meter':        return renderMeter(buf, dispW, dispH, w);
    case 'gauge':        return renderGauge(buf, dispW, dispH, w);

    case 'battery':      return renderBattery(buf, dispW, dispH, w);
  }
}

/* ---------- helpers ---------- */

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function normalize(v: number, min: number, max: number) {
  if (max === min) return 0;
  return clamp01((v - min) / (max - min));
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

function drawText(buf: PixelBuffer, dispW: number, dispH: number, font: string, x: number, baselineY: number, text: string) {
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

/* ---------- Analog clock ---------- */

function renderAnalogClock(buf: PixelBuffer, dispW: number, dispH: number, w: AnalogClockWidget) {
  const r = Math.max(4, w.radius);
  drawCircle(buf, dispW, dispH, w.x, w.y, r);
  if (w.showTicks) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const x1 = w.x + Math.round(Math.cos(a) * (r - 2));
      const y1 = w.y + Math.round(Math.sin(a) * (r - 2));
      const x2 = w.x + Math.round(Math.cos(a) * r);
      const y2 = w.y + Math.round(Math.sin(a) * r);
      drawLine(buf, dispW, dispH, x1, y1, x2, y2);
    }
  }

  let h: number, m: number, s: number;
  if (w.valueSource === 'time') {
    const d = new Date();
    h = d.getHours() % 12; m = d.getMinutes(); s = d.getSeconds();
  } else {
    // simValue interpreted as seconds-since-midnight
    const v = Math.max(0, Math.floor(w.simValue));
    h = Math.floor(v / 3600) % 12;
    m = Math.floor(v / 60) % 60;
    s = v % 60;
  }

  // Hour hand
  const hourAngle = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const minAngle  = ((m + s / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const secAngle  = (s / 60) * Math.PI * 2 - Math.PI / 2;
  drawLine(buf, dispW, dispH, w.x, w.y,
    w.x + Math.round(Math.cos(hourAngle) * (r * 0.5)),
    w.y + Math.round(Math.sin(hourAngle) * (r * 0.5)));
  drawLine(buf, dispW, dispH, w.x, w.y,
    w.x + Math.round(Math.cos(minAngle) * (r * 0.75)),
    w.y + Math.round(Math.sin(minAngle) * (r * 0.75)));
  if (w.showSecondHand) {
    drawLine(buf, dispW, dispH, w.x, w.y,
      w.x + Math.round(Math.cos(secAngle) * (r - 1)),
      w.y + Math.round(Math.sin(secAngle) * (r - 1)));
  }
  setPixel(buf, dispW, dispH, w.x, w.y);
}

/* ---------- Digital clock ---------- */

function renderDigitalClock(buf: PixelBuffer, dispW: number, dispH: number, w: DigitalClockWidget) {
  let str: string;
  if (w.valueSource === 'time') {
    str = formatClock(w.format, new Date());
  } else {
    const v = Math.max(0, Math.floor(w.simValue));
    const fake = new Date();
    fake.setHours(Math.floor(v / 3600) % 24, Math.floor(v / 60) % 60, v % 60, 0);
    str = formatClock(w.format, fake);
  }
  drawText(buf, dispW, dispH, w.font, w.x, w.y, str);
}

/* ---------- Progress bar ---------- */

function renderProgressBar(buf: PixelBuffer, dispW: number, dispH: number, w: ProgressBarWidget) {
  drawFrame(buf, dispW, dispH, w.x, w.y, w.width, w.height);
  const v = normalize(getWidgetPreviewValue(w), w.min, w.max);
  if (w.orientation === 'horizontal') {
    const fillW = Math.max(0, Math.round((w.width - 2) * v));
    if (fillW > 0) drawBox(buf, dispW, dispH, w.x + 1, w.y + 1, fillW, Math.max(0, w.height - 2));
  } else {
    const fillH = Math.max(0, Math.round((w.height - 2) * v));
    if (fillH > 0) drawBox(buf, dispW, dispH, w.x + 1, w.y + (w.height - 1 - fillH), Math.max(0, w.width - 2), fillH);
  }
}

/* ---------- Meter (segmented progress) ---------- */

function renderMeter(buf: PixelBuffer, dispW: number, dispH: number, w: MeterWidget) {
  drawFrame(buf, dispW, dispH, w.x, w.y, w.width, w.height);
  const segs = Math.max(2, w.segments);
  // Inside the 1px frame: (segs+1) uniform 1px gaps + segs segments
  const space = w.width - 2; // pixels inside the frame
  const gap = 1;
  const segW = Math.max(1, Math.floor((space - (segs + 1) * gap) / segs));
  const totalUsed = segs * segW + (segs + 1) * gap;
  const startX = w.x + 1 + gap + Math.floor((space - totalUsed) / 2); // center any remainder
  const v = normalize(getWidgetPreviewValue(w), w.min, w.max);
  const active = Math.round(v * segs);
  const barH = Math.max(1, w.height - 4);
  for (let i = 0; i < active; i++) {
    drawBox(buf, dispW, dispH, startX + i * (segW + gap), w.y + 2, segW, barH);
  }
}

/* ---------- Gauge ---------- */

function renderGauge(buf: PixelBuffer, dispW: number, dispH: number, w: GaugeWidget) {
  const r = Math.max(6, w.radius);
  drawCircle(buf, dispW, dispH, w.x, w.y, r);
  const sweep = (w.sweepDeg * Math.PI) / 180;
  // Start angle = pointing up (-PI/2) minus half sweep
  const start = -Math.PI / 2 - sweep / 2;
  if (w.showTicks) {
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const a = start + (i / ticks) * sweep;
      const x1 = w.x + Math.round(Math.cos(a) * (r - 3));
      const y1 = w.y + Math.round(Math.sin(a) * (r - 3));
      const x2 = w.x + Math.round(Math.cos(a) * r);
      const y2 = w.y + Math.round(Math.sin(a) * r);
      drawLine(buf, dispW, dispH, x1, y1, x2, y2);
    }
  }
  const v = normalize(getWidgetPreviewValue(w), w.min, w.max);
  const a = start + v * sweep;
  drawLine(buf, dispW, dispH, w.x, w.y,
    w.x + Math.round(Math.cos(a) * (r - 1)),
    w.y + Math.round(Math.sin(a) * (r - 1)));
  setPixel(buf, dispW, dispH, w.x, w.y);
}

/* ---------- Battery ---------- */

function renderBattery(buf: PixelBuffer, dispW: number, dispH: number, w: BatteryWidget) {
  const tipW = 2;
  const bodyW = Math.max(6, w.width - tipW);
  drawFrame(buf, dispW, dispH, w.x, w.y, bodyW, w.height);
  // terminal nub
  const nubH = Math.max(2, Math.floor(w.height / 2));
  drawBox(buf, dispW, dispH, w.x + bodyW, w.y + Math.floor((w.height - nubH) / 2), tipW, nubH);
  const v = normalize(getWidgetPreviewValue(w), w.min, w.max);
  const fillW = Math.max(0, Math.round((bodyW - 4) * v));
  if (fillW > 0) drawBox(buf, dispW, dispH, w.x + 2, w.y + 2, fillW, Math.max(0, w.height - 4));
}

/* ============================================================
   Defaults
   ============================================================ */

export function makeDefaultWidget(type: ProceduralWidget['type'], id: string, name: string, x: number, y: number): ProceduralWidget {
  const base = {
    id, name, visible: true, x, y, simValue: 50,
    valueSource: 'sim' as const, variableName: '',
  };
  switch (type) {
    case 'analogClock':
      return { ...base, type, valueSource: 'time', simValue: 12 * 3600, radius: 20, min: 0, max: 86400, showTicks: true, showSecondHand: true };
    case 'digitalClock':
      return { ...base, type, valueSource: 'time', simValue: 12 * 3600, font: 'u8g2_font_7x13_tr', format: 'HH:MM:SS', min: 0, max: 86400 };
    case 'progressBar':
      return { ...base, type, width: 64, height: 10, orientation: 'horizontal', min: 0, max: 100, simValue: 60 };
    case 'meter':
      return { ...base, type, width: 64, height: 12, segments: 8, min: 0, max: 100, simValue: 60 };
    case 'gauge':
      return { ...base, type, radius: 22, sweepDeg: 240, showTicks: true, min: 0, max: 100, simValue: 60 };
    case 'battery':
      return { ...base, type, width: 24, height: 12, min: 0, max: 100, simValue: 80 };
  }
}

/* ============================================================
   C++ code generation
   ============================================================ */

/** Sanitize an arbitrary string into a valid C identifier. */
function ident(s: string): string {
  const clean = s.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(clean) ? `_${clean}` : clean;
}

/** Returns the C expression that yields the widget's runtime value. */
function valueExpr(w: ProceduralWidget): string {
  if (w.valueSource === 'variable' && w.variableName) return w.variableName;
  if (w.valueSource === 'time') return '(uint32_t)((millis() / 1000UL) % 86400UL)';
  // sim
  if (Number.isInteger(w.simValue)) return `${w.simValue}`;
  return `${w.simValue}f`;
}

/** Emit a single procedural widget's drawing block (indented two spaces). */
export function emitWidget(out: string[], w: ProceduralWidget): void {
  const id = ident(w.id);
  out.push('');
  out.push(`/** Widget "${w.name}" (${w.type}) */`);
  out.push(`void drawWidget_${id}() {`);
  switch (w.type) {
    case 'analogClock': emitAnalogClock(out, w); break;
    case 'digitalClock': emitDigitalClock(out, w); break;
    case 'progressBar': emitProgressBar(out, w); break;
    case 'meter': emitMeter(out, w); break;
    case 'gauge': emitGauge(out, w); break;
    case 'battery': emitBattery(out, w); break;
  }
  out.push('}');
}

function emitNormalize(out: string[], w: ProceduralWidget) {
  out.push(`  float __v = (float)(${valueExpr(w)});`);
  out.push(`  float __min = ${w.min}f, __max = ${w.max}f;`);
  out.push(`  float __n = (__max == __min) ? 0.0f : (__v - __min) / (__max - __min);`);
  out.push(`  if (__n < 0) __n = 0; if (__n > 1) __n = 1;`);
}

function emitAnalogClock(out: string[], w: AnalogClockWidget) {
  out.push(`  const int __cx = ${w.x}, __cy = ${w.y}, __r = ${w.radius};`);
  out.push(`  u8g2.drawCircle(__cx, __cy, __r);`);
  if (w.showTicks) {
    out.push(`  for (int __i = 0; __i < 12; __i++) {`);
    out.push(`    float __a = (__i / 12.0f) * 6.2831853f - 1.5707963f;`);
    out.push(`    u8g2.drawLine(__cx + (int)(cosf(__a) * (__r - 2)), __cy + (int)(sinf(__a) * (__r - 2)),`);
    out.push(`                  __cx + (int)(cosf(__a) * __r),       __cy + (int)(sinf(__a) * __r));`);
    out.push(`  }`);
  }
  if (w.valueSource === 'time') {
    out.push(`  uint32_t __secs = (millis() / 1000UL) % 86400UL;`);
  } else {
    out.push(`  uint32_t __secs = (uint32_t)(${valueExpr(w)}) % 86400UL;`);
  }
  out.push(`  int __h = (__secs / 3600) % 12;`);
  out.push(`  int __m = (__secs / 60) % 60;`);
  out.push(`  int __s = __secs % 60;`);
  out.push(`  float __ah = ((__h + __m / 60.0f) / 12.0f) * 6.2831853f - 1.5707963f;`);
  out.push(`  float __am = ((__m + __s / 60.0f) / 60.0f) * 6.2831853f - 1.5707963f;`);
  out.push(`  u8g2.drawLine(__cx, __cy, __cx + (int)(cosf(__ah) * (__r * 0.5f)), __cy + (int)(sinf(__ah) * (__r * 0.5f)));`);
  out.push(`  u8g2.drawLine(__cx, __cy, __cx + (int)(cosf(__am) * (__r * 0.75f)), __cy + (int)(sinf(__am) * (__r * 0.75f)));`);
  if (w.showSecondHand) {
    out.push(`  float __as = (__s / 60.0f) * 6.2831853f - 1.5707963f;`);
    out.push(`  u8g2.drawLine(__cx, __cy, __cx + (int)(cosf(__as) * (__r - 1)), __cy + (int)(sinf(__as) * (__r - 1)));`);
  }
  out.push(`  u8g2.drawPixel(__cx, __cy);`);
}

function emitDigitalClock(out: string[], w: DigitalClockWidget) {
  // Build a printf-format from format tokens.
  // We replace HH/MM/SS with %02d and H/M/S with %d, tracking order.
  const tokens: string[] = [];
  let fmt = w.format;
  fmt = fmt.replace(/HH|MM|SS|H|M|S/g, (m) => { tokens.push(m); return m === 'H' || m === 'M' || m === 'S' ? '%d' : '%02d'; });
  const argMap: Record<string, string> = { H: '__h', HH: '__h', M: '__m', MM: '__m', S: '__s', SS: '__s' };
  const args = tokens.map(t => argMap[t]).join(', ');
  if (w.valueSource === 'time') {
    out.push(`  uint32_t __secs = (millis() / 1000UL) % 86400UL;`);
  } else {
    out.push(`  uint32_t __secs = (uint32_t)(${valueExpr(w)}) % 86400UL;`);
  }
  out.push(`  int __h = (__secs / 3600) % 24;`);
  out.push(`  int __m = (__secs / 60) % 60;`);
  out.push(`  int __s = __secs % 60;`);
  out.push(`  char __buf[32];`);
  out.push(`  snprintf(__buf, sizeof(__buf), "${fmt.replace(/"/g, '\\"')}"${args ? `, ${args}` : ''});`);
  out.push(`  u8g2.setFont(${w.font});`);
  out.push(`  u8g2.drawStr(${w.x}, ${w.y}, __buf);`);
}

function emitProgressBar(out: string[], w: ProgressBarWidget) {
  emitNormalize(out, w);
  out.push(`  u8g2.drawFrame(${w.x}, ${w.y}, ${w.width}, ${w.height});`);
  if (w.orientation === 'horizontal') {
    out.push(`  int __fw = (int)((${w.width} - 2) * __n);`);
    out.push(`  if (__fw > 0) u8g2.drawBox(${w.x + 1}, ${w.y + 1}, __fw, ${Math.max(0, w.height - 2)});`);
  } else {
    out.push(`  int __fh = (int)((${w.height} - 2) * __n);`);
    out.push(`  if (__fh > 0) u8g2.drawBox(${w.x + 1}, ${w.y + w.height - 1} - __fh, ${Math.max(0, w.width - 2)}, __fh);`);
  }
}

function emitMeter(out: string[], w: MeterWidget) {
  emitNormalize(out, w);
  const segs = Math.max(2, w.segments);
  const space = w.width - 2;
  const gap = 1;
  const segW = Math.max(1, Math.floor((space - (segs + 1) * gap) / segs));
  const totalUsed = segs * segW + (segs + 1) * gap;
  const startX = w.x + 1 + gap + Math.floor((space - totalUsed) / 2);
  const barH = Math.max(1, w.height - 4);
  out.push(`  u8g2.drawFrame(${w.x}, ${w.y}, ${w.width}, ${w.height});`);
  out.push(`  int __active = (int)(__n * ${segs} + 0.5f);`);
  out.push(`  for (int __i = 0; __i < __active; __i++) {`);
  out.push(`    int __sx = ${startX} + __i * ${segW + gap};`);
  out.push(`    u8g2.drawBox(__sx, ${w.y + 2}, ${segW}, ${barH});`);
  out.push(`  }`);
}

function emitGauge(out: string[], w: GaugeWidget) {
  emitNormalize(out, w);
  out.push(`  const int __cx = ${w.x}, __cy = ${w.y}, __r = ${w.radius};`);
  out.push(`  const float __sweep = ${w.sweepDeg}f * 0.01745329f;`);
  out.push(`  const float __start = -1.5707963f - __sweep * 0.5f;`);
  out.push(`  u8g2.drawCircle(__cx, __cy, __r);`);
  if (w.showTicks) {
    out.push(`  for (int __i = 0; __i <= 5; __i++) {`);
    out.push(`    float __a = __start + (__i / 5.0f) * __sweep;`);
    out.push(`    u8g2.drawLine(__cx + (int)(cosf(__a) * (__r - 3)), __cy + (int)(sinf(__a) * (__r - 3)),`);
    out.push(`                  __cx + (int)(cosf(__a) * __r),       __cy + (int)(sinf(__a) * __r));`);
    out.push(`  }`);
  }
  out.push(`  float __a = __start + __n * __sweep;`);
  out.push(`  u8g2.drawLine(__cx, __cy, __cx + (int)(cosf(__a) * (__r - 1)), __cy + (int)(sinf(__a) * (__r - 1)));`);
  out.push(`  u8g2.drawPixel(__cx, __cy);`);
}

function emitBattery(out: string[], w: BatteryWidget) {
  emitNormalize(out, w);
  const tipW = 2;
  const bodyW = Math.max(6, w.width - tipW);
  const nubH = Math.max(2, Math.floor(w.height / 2));
  out.push(`  u8g2.drawFrame(${w.x}, ${w.y}, ${bodyW}, ${w.height});`);
  out.push(`  u8g2.drawBox(${w.x + bodyW}, ${w.y + Math.floor((w.height - nubH) / 2)}, ${tipW}, ${nubH});`);
  out.push(`  int __fw = (int)((${bodyW} - 4) * __n);`);
  out.push(`  if (__fw > 0) u8g2.drawBox(${w.x + 2}, ${w.y + 2}, __fw, ${Math.max(0, w.height - 4)});`);
}
