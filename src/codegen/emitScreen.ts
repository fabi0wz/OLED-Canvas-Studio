import type { BitmapElement, DisplayConfig, FrameAnimation, Screen } from '../types';
import { emitWidget } from '../widgets';
import { toIdent, toCId, toXbmBytes, computeAnimBoundingBox } from './helpers';
import { emitElement } from './emitElement';
import { rasterizeElementsToBitmap } from './rasterize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitXbmData(lines: string[], bytes: number[]): void {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 12) {
    chunks.push('  ' + bytes.slice(i, i + 12).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', '));
  }
  if (chunks.length) lines.push(chunks.join(',\n'));
}

// ---------------------------------------------------------------------------
// Exported animation emitters — reused by emitAnimSnippet
// ---------------------------------------------------------------------------

export interface AnimEmitMeta {
  animId: string;
  bbox: { x: number; y: number; w: number; h: number };
  bboxBytes: number;
  N: number;
  durs: number[];
  playMode: 'loop' | 'once' | 'pingpong';
  totalMs: number;
  /** Pingpong cycle duration (2*total - durs[0] - durs[N-1]). */
  cyclePPMs: number;
}

/**
 * Emit PROGMEM data arrays for one animation (frame 0 + XOR deltas).
 * Uses bbox-cropped frames instead of full-display bitmaps.
 */
export function emitAnimPROGMEM(
  lines: string[],
  a: FrameAnimation,
  display: DisplayConfig,
  animId: string,
): AnimEmitMeta {
  const bbox = computeAnimBoundingBox(a, display.width, display.height);
  const bboxBytes = Math.ceil(bbox.w / 8) * bbox.h;
  const N = a.frames.length;
  const durs = a.frames.map(f => Math.max(16, f.durationMs));
  const totalMs = durs.reduce((s, d) => s + d, 0);
  const cyclePPMs = N > 1 ? Math.max(0, 2 * totalMs - durs[0] - durs[N - 1]) : 0;

  // Rasterize every frame into the cropped bbox
  const allXbms: number[][] = a.frames.map(f =>
    toXbmBytes(rasterizeElementsToBitmap(f.elements, bbox.w, bbox.h, bbox.x, bbox.y), bbox.w, bbox.h),
  );

  // --- Frame 0 (full baseline) ---
  lines.push(`static const unsigned char anim_${animId}_f0[] PROGMEM = {`);
  emitXbmData(lines, allXbms[0]);
  lines.push('};');

  if (N > 1) {
    // Forward deltas: delta[i] = XOR(frame[i], frame[i+1])
    // For loop mode an extra wrap delta: delta[N-1] = XOR(frame[N-1], frame[0])
    const numDeltas = a.playMode === 'loop' ? N : N - 1;
    const deltaNames: string[] = [];
    for (let i = 0; i < numDeltas; i++) {
      const fromXbm = allXbms[i % N];
      const toXbm = allXbms[(i + 1) % N];
      const deltaXbm = fromXbm.map((b, j) => b ^ toXbm[j]);
      const dName = `anim_${animId}_d${i}`;
      deltaNames.push(dName);
      lines.push(`static const unsigned char ${dName}[] PROGMEM = {`);
      emitXbmData(lines, deltaXbm);
      lines.push('};');
    }
    lines.push(`static const unsigned char* const anim_${animId}_deltas[${numDeltas}] PROGMEM = {`);
    for (const dn of deltaNames) lines.push(`  ${dn},`);
    lines.push('};');
  }

  lines.push(`static const uint16_t anim_${animId}_durs[${N}] = { ${durs.join(', ')} };`);

  return { animId, bbox, bboxBytes, N, durs, playMode: a.playMode, totalMs, cyclePPMs };
}

/**
 * Emit the drawAnim_<id>() playback function.
 * drawXExpr / drawYExpr: C expressions for the top-left screen position of the bbox.
 * withPositionParam: if true, adds (int16_t px, int16_t py) to the signature so the
 *   caller can position the animation — used for standalone snippet export.
 */
export function emitAnimPlaybackFn(
  lines: string[],
  meta: AnimEmitMeta,
  drawXExpr: string,
  drawYExpr: string,
  withPositionParam: boolean,
): void {
  const { animId, bbox, bboxBytes, N, playMode, totalMs, cyclePPMs } = meta;
  const paramStr = withPositionParam ? '(int16_t px, int16_t py)' : '()';
  lines.push(`void drawAnim_${animId}${paramStr} {`);

  if (N === 1) {
    // Single frame — no state machine needed
    lines.push(`  u8g2.drawXBMP(${drawXExpr}, ${drawYExpr}, ${bbox.w}, ${bbox.h}, anim_${animId}_f0);`);
    lines.push('}');
    return;
  }

  // Multi-frame: XOR-delta state machine
  lines.push(`  static uint8_t __buf[${bboxBytes}];`);
  lines.push(`  static uint8_t __cur = 255;`);
  lines.push(`  if (__cur == 255) { for (uint16_t __i = 0; __i < ${bboxBytes}U; __i++) __buf[__i] = pgm_read_byte(anim_${animId}_f0 + __i); __cur = 0; }`);

  if (playMode === 'once') {
    lines.push(`  uint32_t __t = millis(), __acc = 0; uint8_t __tgt = ${N - 1};`);
    lines.push(`  for (uint8_t __i = 0; __i < ${N}; __i++) { __acc += anim_${animId}_durs[__i]; if (__t < __acc) { __tgt = __i; break; } }`);
    lines.push(`  while (__cur < __tgt) {`);
    lines.push(`    const unsigned char* __d = (const unsigned char*)pgm_read_ptr(&anim_${animId}_deltas[__cur]);`);
    lines.push(`    for (uint16_t __b = 0; __b < ${bboxBytes}U; __b++) __buf[__b] ^= pgm_read_byte(__d + __b);`);
    lines.push(`    __cur++;`);
    lines.push(`  }`);
  } else if (playMode === 'pingpong') {
    lines.push(`  const uint32_t __half = ${totalMs}UL, __cycle = ${cyclePPMs}UL;`);
    lines.push(`  uint32_t __t = __cycle ? (millis() % __cycle) : 0; uint8_t __tgt;`);
    lines.push(`  if (__t < __half) {`);
    lines.push(`    uint32_t __acc = 0; __tgt = ${N - 1};`);
    lines.push(`    for (uint8_t __i = 0; __i < ${N}; __i++) { __acc += anim_${animId}_durs[__i]; if (__t < __acc) { __tgt = __i; break; } }`);
    lines.push(`  } else {`);
    lines.push(`    uint32_t __t2 = __t - __half, __acc = 0; __tgt = 0;`);
    lines.push(`    for (int8_t __i = ${N - 2}; __i >= 0; __i--) { __acc += anim_${animId}_durs[__i]; if (__t2 < __acc) { __tgt = (uint8_t)__i; break; } }`);
    lines.push(`  }`);
    lines.push(`  for (uint8_t __s = 0; __s < ${N} && __cur != __tgt; __s++) {`);
    lines.push(`    uint8_t __di = (__cur < __tgt) ? __cur : (uint8_t)(__cur - 1);`);
    lines.push(`    if (__cur < __tgt) __cur++; else __cur--;`);
    lines.push(`    const unsigned char* __d = (const unsigned char*)pgm_read_ptr(&anim_${animId}_deltas[__di]);`);
    lines.push(`    for (uint16_t __b = 0; __b < ${bboxBytes}U; __b++) __buf[__b] ^= pgm_read_byte(__d + __b);`);
    lines.push(`  }`);
  } else {
    // loop
    lines.push(`  const uint32_t __cycle = ${totalMs}UL;`);
    lines.push(`  uint32_t __t = __cycle ? (millis() % __cycle) : 0, __acc = 0; uint8_t __tgt = 0;`);
    lines.push(`  for (uint8_t __i = 0; __i < ${N}; __i++) { __acc += anim_${animId}_durs[__i]; if (__t < __acc) { __tgt = __i; break; } }`);
    lines.push(`  for (uint8_t __s = 0; __s < ${N} && __cur != __tgt; __s++) {`);
    lines.push(`    const unsigned char* __d = (const unsigned char*)pgm_read_ptr(&anim_${animId}_deltas[__cur]);`);
    lines.push(`    for (uint16_t __b = 0; __b < ${bboxBytes}U; __b++) __buf[__b] ^= pgm_read_byte(__d + __b);`);
    lines.push(`    __cur = (uint8_t)((__cur + 1) % ${N});`);
    lines.push(`  }`);
  }

  lines.push(`  u8g2.drawXBMP(${drawXExpr}, ${drawYExpr}, ${bbox.w}, ${bbox.h}, __buf);`);
  lines.push('}');
}

/**
 * Emit all C code for one screen (bitmaps, layer functions, animations,
 * widgets, drawScreen_<id>() composer).
 * Returns the name of the composed drawScreen function.
 */
export function emitScreen(
  lines: string[],
  screen: Screen,
  display: DisplayConfig,
  screenIdx: number,
): string {
  const screenNs = `scr${screenIdx}_${toCId(screen.id)}`;
  const { layers, animations, widgets, erasedPixels } = screen;

  lines.push('');
  lines.push(`// ============================================================`);
  lines.push(`//  SCREEN ${screenIdx + 1}: "${screen.name}"  (transition: ${screen.transition})`);
  lines.push(`// ============================================================`);

  // Bitmap data
  const bitmapEls: BitmapElement[] = [];
  function collectBitmaps(els: import('../types').CanvasElement[]) {
    for (const el of els) {
      if (el.type === 'bitmap' && el.visible) bitmapEls.push(el);
      if (el.type === 'group') collectBitmaps(el.children);
    }
  }
  for (const l of layers) collectBitmaps(l.elements);
  if (bitmapEls.length > 0) {
    lines.push(`// Bitmap data for screen "${screen.name}"`);
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

  // Per-layer functions
  const usedIdents = new Set<string>();
  const layerFnNames: string[] = layers.map((l) => {
    let base = `${screenNs}_draw${toIdent(l.name)}`;
    let name = base;
    let i = 2;
    while (usedIdents.has(name)) name = `${base}${i++}`;
    usedIdents.add(name);
    return name;
  });

  lines.push(`// Layer functions for screen "${screen.name}"`);
  layers.forEach((layer, idx) => {
    const fnName = layerFnNames[idx];
    const visibleEls = layer.elements.filter((e) => e.visible);
    lines.push('');
    lines.push(`/** [${screen.name}] Layer "${layer.name}" — ${visibleEls.length} element(s)${layer.visible ? '' : '  [HIDDEN]'} */`);
    lines.push(`void ${fnName}() {`);
    if (visibleEls.length === 0) {
      lines.push('  // (empty)');
    } else {
      const fontRef = { font: '' };
      for (const el of visibleEls) emitElement(lines, el, fontRef);
    }
    lines.push('}');
  });

  // Eraser mask
  const eraserFn = erasedPixels.length > 0 ? `${screenNs}_applyEraserMask` : null;
  if (eraserFn) {
    lines.push('');
    lines.push(`/** [${screen.name}] User-erased pixels — applied last. */`);
    lines.push(`void ${eraserFn}() {`);
    lines.push('  u8g2.setDrawColor(0);');
    for (const [x, y] of erasedPixels) lines.push(`  u8g2.drawPixel(${x}, ${y});`);
    lines.push('  u8g2.setDrawColor(1);');
    lines.push('}');
  }

  // Animations — bbox-cropped frames + XOR-delta encoding
  for (const a of animations) {
    if (!a.visible || a.frames.length === 0) continue;
    const animId = toCId(a.id);
    lines.push('');
    lines.push(`// [${screen.name}] Animation "${a.name}" (${a.frames.length} frame(s), ${a.playMode})`);
    const meta = emitAnimPROGMEM(lines, a, display, animId);
    // Position: bbox top-left + animation-level offset (a.x/a.y, typically 0)
    const drawX = `${meta.bbox.x + a.x}`;
    const drawY = `${meta.bbox.y + a.y}`;
    emitAnimPlaybackFn(lines, meta, drawX, drawY, false);
  }

  // Widgets
  if (widgets.length > 0) {
    lines.push('');
    lines.push(`// [${screen.name}] Widgets`);
    for (const w of widgets) {
      if (!w.visible) continue;
      emitWidget(lines, w);
    }
  }

  // Composed drawScreen function
  const drawScreenFn = `drawScreen_${screenNs}`;
  lines.push('');
  lines.push(`/** Render screen "${screen.name}". */`);
  lines.push(`void ${drawScreenFn}() {`);
  layers.forEach((layer, idx) => {
    if (!layer.visible) lines.push(`  // ${layerFnNames[idx]}();  // [layer hidden]`);
    else lines.push(`  ${layerFnNames[idx]}();`);
  });
  if (eraserFn) lines.push(`  ${eraserFn}();`);
  lines.push(`}`);

  return drawScreenFn;
}
