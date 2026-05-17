import type {
  ProceduralWidget, AnalogClockWidget, DigitalClockWidget,
  ProgressBarWidget, MeterWidget, GaugeWidget, BatteryWidget,
} from '../types';
import type { PixelBuffer } from '../pixelEngine';
import { createBuffer, drawCircle, drawLine, drawFrame, drawBox, setPixel, clearPixel } from '../pixelEngine';
import { getWidgetPreviewValue, normalize, formatClock, drawText } from './helpers';

export function renderWidget(
  buf: PixelBuffer, dispW: number, dispH: number,
  w: ProceduralWidget,
): void {
  if (w.inverted) {
    // Render into a local temp buffer the same size as the display, then
    // apply as clearPixel (black-on-white) into the destination buffer.
    const tmp = createBuffer(dispW, dispH);
    renderWidgetDirect(tmp, dispW, dispH, w);
    for (let i = 0; i < dispW * dispH; i++) {
      if (tmp[i]) {
        const px = i % dispW;
        const py = (i - px) / dispW;
        clearPixel(buf, dispW, dispH, px, py);
      }
    }
    return;
  }
  renderWidgetDirect(buf, dispW, dispH, w);
}

/** Render a widget directly (always sets pixels). */
function renderWidgetDirect(
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
    const v = Math.max(0, Math.floor(w.simValue));
    h = Math.floor(v / 3600) % 12;
    m = Math.floor(v / 60) % 60;
    s = v % 60;
  }

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

function renderMeter(buf: PixelBuffer, dispW: number, dispH: number, w: MeterWidget) {
  drawFrame(buf, dispW, dispH, w.x, w.y, w.width, w.height);
  const segs = Math.max(2, w.segments);
  const space = w.width - 2;
  const gap = 1;
  const segW = Math.max(1, Math.floor((space - (segs + 1) * gap) / segs));
  const totalUsed = segs * segW + (segs + 1) * gap;
  const startX = w.x + 1 + gap + Math.floor((space - totalUsed) / 2);
  const v = normalize(getWidgetPreviewValue(w), w.min, w.max);
  const active = Math.round(v * segs);
  const barH = Math.max(1, w.height - 4);
  for (let i = 0; i < active; i++) {
    drawBox(buf, dispW, dispH, startX + i * (segW + gap), w.y + 2, segW, barH);
  }
}

function renderGauge(buf: PixelBuffer, dispW: number, dispH: number, w: GaugeWidget) {
  const r = Math.max(6, w.radius);
  drawCircle(buf, dispW, dispH, w.x, w.y, r);
  const sweep = (w.sweepDeg * Math.PI) / 180;
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

function renderBattery(buf: PixelBuffer, dispW: number, dispH: number, w: BatteryWidget) {
  const tipW = 2;
  const bodyW = Math.max(6, w.width - tipW);
  drawFrame(buf, dispW, dispH, w.x, w.y, bodyW, w.height);
  const nubH = Math.max(2, Math.floor(w.height / 2));
  drawBox(buf, dispW, dispH, w.x + bodyW, w.y + Math.floor((w.height - nubH) / 2), tipW, nubH);
  const v = normalize(getWidgetPreviewValue(w), w.min, w.max);
  const fillW = Math.max(0, Math.round((bodyW - 4) * v));
  if (fillW > 0) drawBox(buf, dispW, dispH, w.x + 2, w.y + 2, fillW, Math.max(0, w.height - 4));
}
