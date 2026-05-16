import type {
  ProceduralWidget, AnalogClockWidget, DigitalClockWidget,
  ProgressBarWidget, MeterWidget, GaugeWidget, BatteryWidget,
} from '../types';

/** Sanitize an arbitrary string into a valid C identifier. */
function ident(s: string): string {
  const clean = s.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(clean) ? `_${clean}` : clean;
}

/** Returns the C expression that yields the widget's runtime value. */
function valueExpr(w: ProceduralWidget): string {
  if (w.valueSource === 'variable' && w.variableName) return w.variableName;
  if (w.valueSource === 'time') return '(uint32_t)((millis() / 1000UL) % 86400UL)';
  if (Number.isInteger(w.simValue)) return `${w.simValue}`;
  return `${w.simValue}f`;
}

function emitNormalize(out: string[], w: ProceduralWidget) {
  out.push(`  float __v = (float)(${valueExpr(w)});`);
  out.push(`  float __min = ${w.min}f, __max = ${w.max}f;`);
  out.push(`  float __n = (__max == __min) ? 0.0f : (__v - __min) / (__max - __min);`);
  out.push(`  if (__n < 0) __n = 0; if (__n > 1) __n = 1;`);
}

/** Emit a single procedural widget's drawing block (indented two spaces). */
export function emitWidget(out: string[], w: ProceduralWidget): void {
  const id = ident(w.id);
  out.push('');
  out.push(`/** Widget "${w.name}" (${w.type}) */`);
  out.push(`void drawWidget_${id}() {`);
  switch (w.type) {
    case 'analogClock':  emitAnalogClock(out, w); break;
    case 'digitalClock': emitDigitalClock(out, w); break;
    case 'progressBar':  emitProgressBar(out, w); break;
    case 'meter':        emitMeter(out, w); break;
    case 'gauge':        emitGauge(out, w); break;
    case 'battery':      emitBattery(out, w); break;
  }
  out.push('}');
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
