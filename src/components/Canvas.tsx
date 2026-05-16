import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore, snapCoord, getAllElements, getAllElementsForRender } from '../store';
import type { CanvasElement, PixelsElement, TextElement, RectElement, LineElement, CircleElement, ProceduralWidget, FrameAnimation } from '../types';
import { FONT_METRICS } from '../types';
import {
  createBuffer, setPixel, clearPixel, renderBuffer,
  drawLine, drawThickLine,
  drawFrame, drawThickFrame, drawBox,
  drawCircle, drawThickCircle, drawDisc,
} from '../pixelEngine';
import { BITMAP_FONTS, type BitmapFont } from '../bitmapFonts';
import { renderWidget, getWidgetBounds } from '../widgets';

let idCounter = 0;
function nextId(type: string) {
  return `${type}_${++idCounter}_${Date.now()}`;
}

/** Render a single CanvasElement into the given 1-bit buffer.
 *  For AnimationRef and WidgetRef elements, the caller must provide lookups. */
function renderElementIntoBuffer(
  buf: Uint8Array,
  dispW: number,
  dispH: number,
  el: CanvasElement,
  lookups?: {
    animations: FrameAnimation[];
    widgets: ProceduralWidget[];
    activeFrameId: string | null;
  }
) {
  if (!el.visible) return;
  if (el.type === 'animationRef') {
    if (!lookups) return;
    const anim = lookups.animations.find((a) => a.id === el.animationId);
    if (!anim || !anim.visible || anim.frames.length === 0) return;
    const frame = anim.frames.find((f) => f.id === lookups.activeFrameId) ?? anim.frames[0];
    // anim.x/y is canonical; render its child elements with that offset baked
    // into each child's x/y already (they're authored relative to the frame's
    // 0,0 — the animation as a whole isn't currently x/y-offset, so render
    // verbatim).
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
      for (const [px, py] of el.pixels) {
        setPixel(buf, dispW, dispH, el.x + px, el.y + py);
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

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

function getHandlePositions(b: { x: number; y: number; w: number; h: number }): Record<HandleId, [number, number]> {
  return {
    nw: [b.x, b.y],
    n: [b.x + b.w / 2, b.y],
    ne: [b.x + b.w, b.y],
    e: [b.x + b.w, b.y + b.h / 2],
    se: [b.x + b.w, b.y + b.h],
    s: [b.x + b.w / 2, b.y + b.h],
    sw: [b.x, b.y + b.h],
    w: [b.x, b.y + b.h / 2],
  };
}

export default function Canvas() {
  const { state, dispatch } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; kind: 'element' | 'widget'; offsetX: number; offsetY: number } | null>(null);
  const [painting, setPainting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const paintTargetRef = useRef<string | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [mousePixel, setMousePixel] = useState<{ x: number; y: number } | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    handle: HandleId;
    startBounds: { x: number; y: number; w: number; h: number };
    startMouse: { px: number; py: number };
  } | null>(null);
  const [hoverHandle, setHoverHandle] = useState<HandleId | null>(null);
  const [creating, setCreating] = useState<{
    id: string;
    type: 'rect' | 'line' | 'circle';
    startPx: number;
    startPy: number;
  } | null>(null);

  const { display, layers, selectedId, showGrid, snapSize, zoom, erasedPixels } = state;
  const w = display.width * zoom;
  const h = display.height * zoom;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      const step = snapSize > 1 ? snapSize : 1;
      for (let x = 0; x <= display.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x * zoom, 0); ctx.lineTo(x * zoom, h);
        ctx.stroke();
      }
      for (let y = 0; y <= display.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom); ctx.lineTo(w, y * zoom);
        ctx.stroke();
      }
    }

    const buf = createBuffer(display.width, display.height);
    const lookups = {
      animations: state.animations,
      widgets: state.widgets,
      activeFrameId: state.editor.activeFrameId,
    };

    // Render the unified element list (static layers + active animation frame).
    for (const { element: el } of getAllElementsForRender(state)) {
      renderElementIntoBuffer(buf, display.width, display.height, el, lookups);
    }

    // Apply eraser mask (clear pixels)
    for (const [ex, ey] of erasedPixels) {
      if (ex >= 0 && ex < display.width && ey >= 0 && ey < display.height) {
        buf[ey * display.width + ex] = 0;
      }
    }

    renderBuffer(ctx, buf, display.width, display.height, zoom);

    // Onion-skin overlay: prev/next frames of the active animation rendered
    // in a separate buffer and composited at reduced opacity in tint colors.
    if (state.editor.mode === 'animation' && state.editor.activeAnimationId) {
      const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
      if (anim && anim.frames.length > 1) {
        const idx = anim.frames.findIndex((f) => f.id === state.editor.activeFrameId);
        const overlays: { frameIdx: number; color: string }[] = [];
        if (state.editor.onionPrev && idx > 0) overlays.push({ frameIdx: idx - 1, color: '#ff5b6b' });
        if (state.editor.onionNext && idx >= 0 && idx < anim.frames.length - 1) overlays.push({ frameIdx: idx + 1, color: '#5bd0ff' });
        for (const ov of overlays) {
          const ofb = createBuffer(display.width, display.height);
          for (const el of anim.frames[ov.frameIdx].elements) {
            renderElementIntoBuffer(ofb, display.width, display.height, el, lookups);
          }
          ctx.save();
          ctx.globalAlpha = state.editor.onionOpacity;
          renderBuffer(ctx, ofb, display.width, display.height, zoom, ov.color);
          ctx.restore();
        }
      }
    }

    // Selection highlight + resize handles
    if (selectedId) {
      const sel = findElementById(selectedId);
      if (sel) {
        const b = getElementBounds(sel);
        ctx.strokeStyle = '#ffb627';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(b.x * zoom - 2, b.y * zoom - 2, b.w * zoom + 4, b.h * zoom + 4);
        ctx.setLineDash([]);

        if (state.activeTool === 'select' && sel.type !== 'text' && sel.type !== 'pixels' && sel.type !== 'animationRef' && sel.type !== 'widgetRef') {
          const handles = getHandlePositions(b);
          const sz = 7;
          ctx.lineWidth = 1;
          for (const [hid, pos] of Object.entries(handles) as [HandleId, [number, number]][]) {
            const hx = pos[0] * zoom;
            const hy = pos[1] * zoom;
            const isHover = hid === hoverHandle || hid === resizing?.handle;
            ctx.fillStyle = isHover ? '#ffb627' : '#1a1c1f';
            ctx.strokeStyle = '#ffb627';
            ctx.fillRect(hx - sz / 2, hy - sz / 2, sz, sz);
            ctx.strokeRect(hx - sz / 2 + 0.5, hy - sz / 2 + 0.5, sz - 1, sz - 1);
          }
        }
      }
    }

    // Widget selection outline (cyan to distinguish from element selection).
    if (state.editor.selectedWidgetId) {
      const wgt = state.widgets.find((w) => w.id === state.editor.selectedWidgetId);
      if (wgt) {
        const b = getWidgetBounds(wgt);
        ctx.strokeStyle = '#5bd0ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(b.x * zoom - 2, b.y * zoom - 2, b.w * zoom + 4, b.h * zoom + 4);
        ctx.setLineDash([]);
      }
    }

    if (state.activeTool === 'eraser' && mousePixel) {
      ctx.fillStyle = 'rgba(255, 91, 107, 0.55)';
      ctx.fillRect(mousePixel.x * zoom, mousePixel.y * zoom, zoom, zoom);
    }
  }, [layers, selectedId, showGrid, snapSize, zoom, display, w, h, state, erasedPixels, mousePixel, hoverHandle, resizing]);

  useEffect(() => { draw(); }, [draw]);

  // Frame-animation playback ticker (per-frame duration honored).
  useEffect(() => {
    if (!state.editor.playing) return;
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    if (!anim || anim.frames.length < 2) return;
    const idx = anim.frames.findIndex((f) => f.id === state.editor.activeFrameId);
    const cur = idx >= 0 ? idx : 0;
    const curFrame = anim.frames[cur];
    const dur = Math.max(16, curFrame.durationMs);
    const t = setTimeout(() => {
      let next: number;
      if (anim.playMode === 'once') {
        next = cur + 1;
        if (next >= anim.frames.length) { dispatch({ type: 'SET_PLAYING', payload: false }); return; }
      } else if (anim.playMode === 'pingpong') {
        // Encode direction via a ref-less approach: ping-pong by even iteration index using current id only.
        next = (cur + 1) % anim.frames.length;
      } else {
        next = (cur + 1) % anim.frames.length;
      }
      dispatch({ type: 'SELECT_FRAME', payload: { animationId: anim.id, frameId: anim.frames[next].id } });
    }, dur);
    return () => clearTimeout(t);
  }, [state.editor.playing, state.editor.activeFrameId, state.editor.activeAnimationId, state.animations, dispatch]);

  // Tick clocks/time-driven widgets once a second so they animate live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasTimeWidget = state.widgets.some((w) => w.valueSource === 'time' && (w.type === 'analogClock' || w.type === 'digitalClock'));
    if (!hasTimeWidget) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [state.widgets]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      switch (e.key.toLowerCase()) {
        case 'v': dispatch({ type: 'SET_TOOL', payload: 'select' }); break;
        case 't': dispatch({ type: 'SET_TOOL', payload: 'add-text' }); break;
        case 'r': dispatch({ type: 'SET_TOOL', payload: 'add-rect' }); break;
        case 'c': dispatch({ type: 'SET_TOOL', payload: 'add-circle' }); break;
        case 'l': dispatch({ type: 'SET_TOOL', payload: 'add-line' }); break;
        case 'd': dispatch({ type: 'SET_TOOL', payload: 'freedraw' }); break;
        case 'e': dispatch({ type: 'SET_TOOL', payload: 'eraser' }); break;
        case 'i': document.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]')?.click(); break;
        case 'delete':
        case 'backspace':
          if (state.editor.selectedWidgetId) dispatch({ type: 'DELETE_WIDGET', payload: state.editor.selectedWidgetId });
          else if (state.selectedId) dispatch({ type: 'DELETE_ELEMENT', payload: state.selectedId });
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch, state.selectedId]);

  // Ctrl+Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', payload: state.zoom + (e.deltaY > 0 ? -1 : 1) });
      }
    }
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [dispatch, state.zoom]);

  function getElementBounds(el: CanvasElement): { x: number; y: number; w: number; h: number } {
    switch (el.type) {
      case 'text': {
        const metrics = FONT_METRICS[el.font] || { width: 6, height: 10 };
        const textW = el.text.length * metrics.width;
        return { x: el.x, y: el.y - metrics.height, w: textW, h: metrics.height };
      }
      case 'rect':
        return { x: el.x, y: el.y, w: el.width, h: el.height };
      case 'line': {
        const minX = Math.min(el.x, el.x2);
        const minY = Math.min(el.y, el.y2);
        const maxX = Math.max(el.x, el.x2);
        const maxY = Math.max(el.y, el.y2);
        return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
      }
      case 'circle':
        // Circle rasterization reaches both extrema, so bounds are 2r+1.
        return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2 + 1, h: el.radius * 2 + 1 };
      case 'pixels': {
        if (el.pixels.length === 0) return { x: el.x, y: el.y, w: 1, h: 1 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [px, py] of el.pixels) {
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
        return { x: el.x + minX, y: el.y + minY, w: Math.max(maxX - minX + 1, 1), h: Math.max(maxY - minY + 1, 1) };
      }
      case 'bitmap':
        return { x: el.x, y: el.y, w: el.bmpWidth, h: el.bmpHeight };
      case 'animationRef': {
        const anim = state.animations.find((a) => a.id === el.animationId);
        if (!anim) return { x: el.x, y: el.y, w: 1, h: 1 };
        // Use display-sized bounds; the animation occupies the whole frame.
        return { x: el.x, y: el.y, w: display.width, h: display.height };
      }
      case 'widgetRef': {
        const wgt = state.widgets.find((w) => w.id === el.widgetId);
        if (!wgt) return { x: el.x, y: el.y, w: 1, h: 1 };
        return getWidgetBounds(wgt);
      }
    }
  }

  function canvasToPixel(clientX: number, clientY: number): { px: number; py: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { px: 0, py: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      px: Math.max(0, Math.min(display.width - 1, Math.floor((clientX - rect.left) / zoom))),
      py: Math.max(0, Math.min(display.height - 1, Math.floor((clientY - rect.top) / zoom))),
    };
  }

  function snap(x: number, y: number): { x: number; y: number } {
    return { x: snapCoord(x, snapSize), y: snapCoord(y, snapSize) };
  }

  /** Look up an element by id across layers AND the active animation frame. */
  function findElementById(id: string): CanvasElement | undefined {
    const fromLayers = getAllElements(state).find((x) => x.element.id === id)?.element;
    if (fromLayers) return fromLayers;
    if (state.editor.mode === 'animation') {
      const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
      const frame = anim?.frames.find((f) => f.id === state.editor.activeFrameId);
      return frame?.elements.find((e) => e.id === id);
    }
    return undefined;
  }

  function hitTestHandle(clientX: number, clientY: number): HandleId | null {
    if (state.activeTool !== 'select' || !selectedId) return null;
    const sel = findElementById(selectedId);
    if (!sel || sel.type === 'text' || sel.type === 'pixels' || sel.type === 'animationRef' || sel.type === 'widgetRef') return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const b = getElementBounds(sel);
    const handles = getHandlePositions(b);
    const tolerance = 6; // screen px from handle center
    for (const [hid, pos] of Object.entries(handles) as [HandleId, [number, number]][]) {
      const sx = rect.left + pos[0] * zoom;
      const sy = rect.top + pos[1] * zoom;
      if (Math.abs(clientX - sx) <= tolerance && Math.abs(clientY - sy) <= tolerance) {
        return hid;
      }
    }
    return null;
  }

  function hitTest(px: number, py: number): CanvasElement | null {
    const all = getAllElements(state);
    for (let i = all.length - 1; i >= 0; i--) {
      const { element: el, layer } = all[i];
      if (!el.visible || !layer.visible) continue;
      const b = getElementBounds(el);
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return el;
      }
    }
    return null;
  }

  function hitTestFrameElement(px: number, py: number): CanvasElement | null {
    if (state.editor.mode !== 'animation') return null;
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    const frame = anim?.frames.find((f) => f.id === state.editor.activeFrameId);
    if (!frame) return null;
    for (let i = frame.elements.length - 1; i >= 0; i--) {
      const el = frame.elements[i];
      if (!el.visible) continue;
      const b = getElementBounds(el);
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return el;
    }
    return null;
  }

  function hitTestWidget(_px: number, _py: number): ProceduralWidget | null {
    // Deprecated: widgets are now picked up via widgetRef elements in layers.
    return null;
  }
  void hitTestWidget;

  function addElementAtPosition(px: number, py: number) {
    const tool = state.activeTool;
    if (tool === 'add-text') {
      const el: TextElement = {
        id: nextId('text'), type: 'text', x: px, y: py + 10,
        visible: true, strokeWidth: 1, text: 'Text',
        font: 'u8g2_font_6x10_tr', align: 'left',
      };
      dispatch({ type: 'ADD_ELEMENT', payload: el });
      dispatch({ type: 'SET_TOOL', payload: 'select' });
      return;
    }

    // Rect / line / circle use drag-to-create. The element is added with a
    // minimal size on mousedown and resized live during mousemove; this
    // function only handles the initial insert.
    let el: CanvasElement | null = null;
    switch (tool) {
      case 'add-rect':
        el = { id: nextId('rect'), type: 'rect', x: px, y: py, visible: true, strokeWidth: 1, width: 1, height: 1, filled: false } as RectElement;
        break;
      case 'add-line':
        el = { id: nextId('line'), type: 'line', x: px, y: py, visible: true, strokeWidth: 1, x2: px, y2: py } as LineElement;
        break;
      case 'add-circle':
        el = { id: nextId('circle'), type: 'circle', x: px, y: py, visible: true, strokeWidth: 1, radius: 1, filled: false } as CircleElement;
        break;
    }
    if (el) {
      dispatch({ type: 'ADD_ELEMENT', payload: el });
      dispatch({ type: 'SELECT_ELEMENT', payload: el.id });
      setCreating({
        id: el.id,
        type: (tool === 'add-rect' ? 'rect' : tool === 'add-line' ? 'line' : 'circle'),
        startPx: px, startPy: py,
      });
    }
  }

  function updateCreatingElement(curPx: number, curPy: number, shift: boolean) {
    if (!creating) return;
    const el = findElementById(creating.id);
    if (!el) return;

    let endX = curPx;
    let endY = curPy;
    if (snapSize > 0) {
      endX = snapCoord(endX, snapSize);
      endY = snapCoord(endY, snapSize);
    }
    const dx = endX - creating.startPx;
    const dy = endY - creating.startPy;

    if (creating.type === 'rect' && el.type === 'rect') {
      let w = dx;
      let h = dy;
      if (shift) {
        const s = Math.max(Math.abs(w), Math.abs(h));
        w = (w < 0 ? -s : s) || 1;
        h = (h < 0 ? -s : s) || 1;
      }
      const x = w >= 0 ? creating.startPx : creating.startPx + w;
      const y = h >= 0 ? creating.startPy : creating.startPy + h;
      // +1 because both start and end pixels are included
      const nw = Math.max(1, Math.abs(w) + 1);
      const nh = Math.max(1, Math.abs(h) + 1);
      dispatch({ type: 'UPDATE_ELEMENT', payload: { ...el, x, y, width: nw, height: nh } });
    } else if (creating.type === 'line' && el.type === 'line') {
      let x2 = endX;
      let y2 = endY;
      if (shift) {
        // Snap angle to nearest 45° multiple.
        const ang = Math.atan2(dy, dx);
        const step = Math.PI / 4;
        const snapped = Math.round(ang / step) * step;
        const len = Math.hypot(dx, dy);
        x2 = Math.round(creating.startPx + Math.cos(snapped) * len);
        y2 = Math.round(creating.startPy + Math.sin(snapped) * len);
      }
      dispatch({ type: 'UPDATE_ELEMENT', payload: { ...el, x: creating.startPx, y: creating.startPy, x2, y2 } });
    } else if (creating.type === 'circle' && el.type === 'circle') {
      // Bounding box from start corner to current point; circle is inscribed.
      // Shift constrains to a square bounding box (always a perfect circle).
      const w = shift ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.abs(dx);
      const h = shift ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.abs(dy);
      const minX = dx >= 0 ? creating.startPx : creating.startPx - w;
      const minY = dy >= 0 ? creating.startPy : creating.startPy - h;
      const r = Math.max(1, Math.round(Math.min(w, h) / 2));
      const cx = Math.round(minX + w / 2);
      const cy = Math.round(minY + h / 2);
      dispatch({ type: 'UPDATE_ELEMENT', payload: { ...el, x: cx, y: cy, radius: r } });
    }
  }

  function handleDoubleClick(_e: React.MouseEvent) {
    // No-op: text is edited via the properties panel.
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    const raw = canvasToPixel(e.clientX, e.clientY);
    const { x: px, y: py } = snap(raw.px, raw.py);

    // Resize handles take priority over normal hit testing.
    if (state.activeTool === 'select' && selectedId) {
      const handle = hitTestHandle(e.clientX, e.clientY);
      if (handle) {
        const sel = findElementById(selectedId);
        if (sel) {
          setResizing({
            id: sel.id,
            handle,
            startBounds: getElementBounds(sel),
            startMouse: { px: raw.px, py: raw.py },
          });
          return;
        }
      }
    }

    if (state.activeTool.startsWith('add-')) {
      addElementAtPosition(px, py);
      return;
    }

    if (state.activeTool === 'eraser') {
      setErasing(true);
      dispatch({ type: 'ERASE_PIXEL', payload: { x: raw.px, y: raw.py } });
      return;
    }

    if (state.activeTool === 'freedraw') {
      const target = state.selectedId
        ? (findElementById(state.selectedId)?.type === 'pixels' ? findElementById(state.selectedId) as PixelsElement : undefined)
        : undefined;

      if (!target) {
        const newEl: PixelsElement = {
          id: nextId('pixels'),
          type: 'pixels',
          x: 0, y: 0,
          visible: true,
          strokeWidth: 1,
          pixels: [[raw.px, raw.py]],
        };
        dispatch({ type: 'ADD_ELEMENT', payload: newEl });
        paintTargetRef.current = newEl.id;
      } else {
        dispatch({ type: 'ADD_PIXELS', payload: { id: target.id, pixels: [[raw.px - target.x, raw.py - target.y]] } });
        paintTargetRef.current = target.id;
      }
      setPainting(true);
      return;
    }

    const hit = hitTest(raw.px, raw.py);
    // Priority: active-frame element (anim mode) > layer element. Widgets and
    // animations are now picked up by hitTest via their ref elements in the
    // layer stack.
    const frameHit = hitTestFrameElement(raw.px, raw.py);
    if (frameHit) {
      dispatch({ type: 'SELECT_ELEMENT', payload: frameHit.id });
      setDragging({ id: frameHit.id, kind: 'element', offsetX: raw.px - frameHit.x, offsetY: raw.py - frameHit.y });
    } else if (hit) {
      // If the hit is a widgetRef, also focus the underlying widget so the
      // properties panel shows widget editors.
      if (hit.type === 'widgetRef') {
        dispatch({ type: 'SELECT_WIDGET', payload: hit.widgetId });
      } else {
        dispatch({ type: 'SELECT_WIDGET', payload: null });
      }
      dispatch({ type: 'SELECT_ELEMENT', payload: hit.id });
      setDragging({ id: hit.id, kind: 'element', offsetX: raw.px - hit.x, offsetY: raw.py - hit.y });
    } else {
      dispatch({ type: 'SELECT_ELEMENT', payload: null });
      dispatch({ type: 'SELECT_WIDGET', payload: null });
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const raw = canvasToPixel(e.clientX, e.clientY);
    setMousePixel({ x: raw.px, y: raw.py });

    const coordsEl = document.getElementById('canvas-coords');
    if (coordsEl) {
      coordsEl.textContent = (raw.px >= 0 && raw.px < display.width && raw.py >= 0 && raw.py < display.height)
        ? `${raw.px},${raw.py}` : '—,—';
    }

    if (panning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
      return;
    }

    if (creating) {
      updateCreatingElement(raw.px, raw.py, e.shiftKey);
      return;
    }

    if (resizing) {
      const { handle, startBounds, id } = resizing;
      const sel = findElementById(id);

      // Circles resize around their fixed centre so the shape never drifts.
      if (sel && sel.type === 'circle') {
        const cx = startBounds.x + startBounds.w / 2;
        const cy = startBounds.y + startBounds.h / 2;
        let r = Math.max(Math.abs(raw.px - cx), Math.abs(raw.py - cy));
        if (snapSize > 0) r = Math.max(1, snapCoord(r, snapSize));
        r = Math.max(1, Math.round(r));
        const nx = Math.round(cx - r);
        const ny = Math.round(cy - r);
        const nd = r * 2;
        dispatch({ type: 'RESIZE_ELEMENT', payload: { id, x: nx, y: ny, width: nd, height: nd } });
        return;
      }

      const dx = raw.px - resizing.startMouse.px;
      const dy = raw.py - resizing.startMouse.py;
      let nx = startBounds.x;
      let ny = startBounds.y;
      let nw = startBounds.w;
      let nh = startBounds.h;
      if (handle.includes('w')) { nx = startBounds.x + dx; nw = startBounds.w - dx; }
      if (handle.includes('e')) { nw = startBounds.w + dx; }
      if (handle.includes('n')) { ny = startBounds.y + dy; nh = startBounds.h - dy; }
      if (handle.includes('s')) { nh = startBounds.h + dy; }
      if (nw < 1) { nx = startBounds.x + startBounds.w - 1; nw = 1; }
      if (nh < 1) { ny = startBounds.y + startBounds.h - 1; nh = 1; }
      if (snapSize > 0) {
        const sx = snapCoord(nx, snapSize);
        const sy = snapCoord(ny, snapSize);
        const sw = Math.max(1, snapCoord(nw, snapSize));
        const sh = Math.max(1, snapCoord(nh, snapSize));
        nx = sx; ny = sy; nw = sw; nh = sh;
      }
      dispatch({ type: 'RESIZE_ELEMENT', payload: { id, x: nx, y: ny, width: nw, height: nh } });
      return;
    }

    if (state.activeTool === 'select' && selectedId && !dragging) {
      const hh = hitTestHandle(e.clientX, e.clientY);
      if (hh !== hoverHandle) setHoverHandle(hh);
    } else if (hoverHandle) {
      setHoverHandle(null);
    }

    if (erasing && state.activeTool === 'eraser') {
      dispatch({ type: 'ERASE_PIXEL', payload: { x: raw.px, y: raw.py } });
      return;
    }

    if (painting && paintTargetRef.current) {
      const target = paintTargetRef.current ? findElementById(paintTargetRef.current) : undefined;
      if (target && target.type === 'pixels') {
        dispatch({ type: 'ADD_PIXELS', payload: { id: target.id, pixels: [[raw.px - target.x, raw.py - target.y]] } });
      }
      return;
    }

    if (!dragging) return;
    const snapped = snap(raw.px - dragging.offsetX, raw.py - dragging.offsetY);
    const newX = snapped.x;
    const newY = snapped.y;

    if (dragging.kind === 'widget') {
      dispatch({ type: 'MOVE_WIDGET', payload: { id: dragging.id, x: newX, y: newY } });
      return;
    }

    const el = findElementById(dragging.id);
    if (!el) return;

    if (el.type === 'widgetRef') {
      dispatch({ type: 'MOVE_WIDGET', payload: { id: el.widgetId, x: newX, y: newY } });
      return;
    }

    if (el.type === 'animationRef') {
      dispatch({ type: 'UPDATE_ANIMATION', payload: { id: el.animationId, changes: { x: newX, y: newY } } });
      return;
    }

    if (el.type === 'line') {
      const dx = newX - el.x;
      const dy = newY - el.y;
      dispatch({
        type: 'MOVE_ELEMENT',
        payload: { id: dragging.id, x: newX, y: newY, x2: el.x2 + dx, y2: el.y2 + dy },
      });
    } else {
      dispatch({ type: 'MOVE_ELEMENT', payload: { id: dragging.id, x: newX, y: newY } });
    }
  }

  function handleMouseUp() {
    if (creating) {
      // If the user just clicked without dragging, give the shape a sensible
      // default size so the click still produces a visible element.
      const el = findElementById(creating.id);
      if (el) {
        if (el.type === 'rect' && (el.width < 2 && el.height < 2)) {
          dispatch({ type: 'UPDATE_ELEMENT', payload: { ...el, width: 30, height: 20 } });
        } else if (el.type === 'line' && el.x === el.x2 && el.y === el.y2) {
          dispatch({ type: 'UPDATE_ELEMENT', payload: { ...el, x2: el.x + 30, y2: el.y } });
        } else if (el.type === 'circle' && el.radius < 2) {
          dispatch({ type: 'UPDATE_ELEMENT', payload: { ...el, radius: 10 } });
        }
      }
      dispatch({ type: 'SET_TOOL', payload: 'select' });
      setCreating(null);
    }
    setDragging(null);
    setPainting(false);
    setErasing(false);
    setPanning(false);
    setResizing(null);
    paintTargetRef.current = null;
  }

  const cursorMap: Record<string, string> = {
    'select': dragging ? 'grabbing' : 'default',
    'freedraw': 'crosshair',
    'eraser': 'crosshair',
    'add-text': 'crosshair',
    'add-rect': 'crosshair',
    'add-line': 'crosshair',
    'add-circle': 'crosshair',
  };
  let cursorStyle = panning ? 'grabbing' : (cursorMap[state.activeTool] || 'default');
  if (resizing) cursorStyle = HANDLE_CURSORS[resizing.handle];
  else if (hoverHandle && state.activeTool === 'select') cursorStyle = HANDLE_CURSORS[hoverHandle];

  return (
    <div ref={containerRef} className="canvas-container">
      <div className="canvas-pan-area" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          style={{ width: w, height: h, imageRendering: 'pixelated', cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="canvas-info">
        {display.type} {display.width}×{display.height} | {zoom}x
        {snapSize > 0 && <> | SNAP {snapSize}px</>}
        {erasedPixels.length > 0 && (
          <button className="reset-pan-btn" onClick={() => dispatch({ type: 'CLEAR_ERASED' })}>
            Clear Erased ({erasedPixels.length})
          </button>
        )}
        {(pan.x !== 0 || pan.y !== 0) && (
          <button className="reset-pan-btn" onClick={() => setPan({ x: 0, y: 0 })}>Reset Pan</button>
        )}
      </div>
    </div>
  );
}
