import type { BitmapElement, DisplayConfig, Screen } from '../types';
import { emitWidget } from '../widgets';
import { toIdent, toCId, toXbmBytes } from './helpers';
import { emitElement } from './emitElement';
import { rasterizeElementsToBitmap } from './rasterize';

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

  // Animations
  for (const a of animations) {
    if (!a.visible || a.frames.length === 0) continue;
    const animId = toCId(a.id);
    lines.push('');
    lines.push(`// [${screen.name}] Animation "${a.name}" (${a.frames.length} frames, ${a.playMode})`);
    const frameNames: string[] = [];
    a.frames.forEach((f, i) => {
      const fname = `anim_${animId}_f${i}`;
      frameNames.push(fname);
      const raster = rasterizeElementsToBitmap(f.elements, display.width, display.height);
      const bytes = toXbmBytes(raster, display.width, display.height);
      lines.push(`static const unsigned char ${fname}[] PROGMEM = {`);
      const chunks: string[] = [];
      for (let bi = 0; bi < bytes.length; bi += 12) {
        chunks.push('  ' + bytes.slice(bi, bi + 12).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', '));
      }
      lines.push(chunks.join(',\n'));
      lines.push('};');
    });
    lines.push(`static const uint16_t anim_${animId}_durs[] = { ${a.frames.map(f => Math.max(16, f.durationMs)).join(', ')} };`);
    lines.push(`static const unsigned char* const anim_${animId}_frames[] = { ${frameNames.join(', ')} };`);
    lines.push(`static const uint8_t anim_${animId}_count = ${a.frames.length};`);
    lines.push(`void drawAnim_${animId}() {`);
    const total = a.frames.reduce((acc, f) => acc + Math.max(16, f.durationMs), 0);
    if (a.playMode === 'once') {
      lines.push(`  uint32_t __t = millis();`);
      lines.push(`  uint32_t __acc = 0; uint8_t __idx = anim_${animId}_count - 1;`);
      lines.push(`  for (uint8_t __i = 0; __i < anim_${animId}_count; __i++) {`);
      lines.push(`    __acc += anim_${animId}_durs[__i];`);
      lines.push(`    if (__t < __acc) { __idx = __i; break; }`);
      lines.push(`  }`);
    } else if (a.playMode === 'pingpong') {
      lines.push(`  const uint32_t __cycle = 2UL * ${total}UL - anim_${animId}_durs[0] - anim_${animId}_durs[anim_${animId}_count - 1];`);
      lines.push(`  uint32_t __t = __cycle ? (millis() % __cycle) : 0;`);
      lines.push(`  uint32_t __acc = 0; uint8_t __idx = 0;`);
      lines.push(`  for (uint8_t __i = 0; __i < anim_${animId}_count; __i++) { __acc += anim_${animId}_durs[__i]; if (__t < __acc) { __idx = __i; break; } }`);
      lines.push(`  if (__t >= ${total}UL) {`);
      lines.push(`    uint32_t __t2 = __t - ${total}UL; __acc = 0;`);
      lines.push(`    for (int __i = anim_${animId}_count - 2; __i > 0; __i--) { __acc += anim_${animId}_durs[__i]; if (__t2 < __acc) { __idx = __i; break; } }`);
      lines.push(`  }`);
    } else {
      lines.push(`  const uint32_t __cycle = ${total}UL;`);
      lines.push(`  uint32_t __t = __cycle ? (millis() % __cycle) : 0;`);
      lines.push(`  uint32_t __acc = 0; uint8_t __idx = 0;`);
      lines.push(`  for (uint8_t __i = 0; __i < anim_${animId}_count; __i++) {`);
      lines.push(`    __acc += anim_${animId}_durs[__i];`);
      lines.push(`    if (__t < __acc) { __idx = __i; break; }`);
      lines.push(`  }`);
    }
    lines.push(`  u8g2.drawXBMP(${a.x}, ${a.y}, ${display.width}, ${display.height}, (const uint8_t*)pgm_read_ptr(&anim_${animId}_frames[__idx]));`);
    lines.push(`}`);
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
