import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { CanvasElement, DisplayConfig, Project, Layer } from './types';
import { DISPLAY_PRESETS } from './types';
import {
  createBuffer,
  drawBox,
  drawCircle,
  drawDisc,
  drawFrame,
  drawLine,
  drawThickCircle,
  drawThickFrame,
  drawThickLine,
} from './pixelEngine';

export type ActiveTool = 'select' | 'freedraw' | 'eraser' | 'add-text' | 'add-rect' | 'add-line' | 'add-circle' | 'add-bitmap';

interface AppState {
  display: DisplayConfig;
  layers: Layer[];
  selectedLayerId: string;
  selectedId: string | null;
  /** Legacy global mask (kept for backward compatibility with old project files). */
  erasedPixels: [number, number][];
  showGrid: boolean;
  snapSize: number; // 0 = off
  zoom: number;
  activeTool: ActiveTool;
}

type Action =
  | { type: 'SET_DISPLAY'; payload: DisplayConfig }
  | { type: 'ADD_ELEMENT'; payload: CanvasElement }
  | { type: 'UPDATE_ELEMENT'; payload: CanvasElement }
  | { type: 'DELETE_ELEMENT'; payload: string }
  | { type: 'SELECT_ELEMENT'; payload: string | null }
  | { type: 'MOVE_ELEMENT'; payload: { id: string; x: number; y: number; x2?: number; y2?: number } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_SNAP'; payload: number }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'LOAD_PROJECT'; payload: Project }
  | { type: 'REORDER_ELEMENT'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'DUPLICATE_ELEMENT'; payload: string }
  | { type: 'SET_TOOL'; payload: ActiveTool }
  | { type: 'ADD_PIXELS'; payload: { id: string; pixels: [number, number][] } }
  | { type: 'ERASE_PIXEL'; payload: { x: number; y: number } }
  | { type: 'CLEAR_ERASED' }
  | { type: 'TRANSFORM_ELEMENT'; payload: { id: string; op: 'flip-h' | 'flip-v' | 'rotate'; angle?: number } }
  | { type: 'RESIZE_ELEMENT'; payload: { id: string; x: number; y: number; width: number; height: number } }
  // Layer actions
  | { type: 'ADD_LAYER'; payload?: { name?: string } }
  | { type: 'DELETE_LAYER'; payload: string }
  | { type: 'RENAME_LAYER'; payload: { id: string; name: string } }
  | { type: 'TOGGLE_LAYER_VISIBLE'; payload: string }
  | { type: 'SELECT_LAYER'; payload: string }
  | { type: 'REORDER_LAYER'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'MOVE_ELEMENT_TO_LAYER'; payload: { elementId: string; layerId: string } };

function makeLayer(name: string, elements: CanvasElement[] = []): Layer {
  return { id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, visible: true, elements };
}

const defaultLayer = makeLayer('main');

const initialState: AppState = {
  display: DISPLAY_PRESETS[0],
  layers: [defaultLayer],
  selectedLayerId: defaultLayer.id,
  selectedId: null,
  erasedPixels: [],
  showGrid: false,
  snapSize: 0,
  zoom: 3,
  activeTool: 'select',
};

// --- helpers ---------------------------------------------------------------

/** Map elements inside a specific layer */
function mapElementsInLayer(
  layers: Layer[],
  layerId: string,
  fn: (elements: CanvasElement[]) => CanvasElement[]
): Layer[] {
  return layers.map((l) => (l.id === layerId ? { ...l, elements: fn(l.elements) } : l));
}

/** Map elements in any layer (used when we know the id but not the layer) */
function mapAllElements(
  layers: Layer[],
  fn: (el: CanvasElement, layer: Layer) => CanvasElement
): Layer[] {
  return layers.map((l) => ({ ...l, elements: l.elements.map((el) => fn(el, l)) }));
}

function findElement(layers: Layer[], id: string): { element: CanvasElement; layer: Layer } | null {
  for (const l of layers) {
    const el = l.elements.find((e) => e.id === id);
    if (el) return { element: el, layer: l };
  }
  return null;
}

function collectPixels(buf: Uint8Array, width: number, height: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (buf[y * width + x]) out.push([x, y]);
    }
  }
  return out;
}

function rasterizeElementToPixels(el: CanvasElement): { x: number; y: number; pixels: [number, number][] } | null {
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

  // Text erasing remains unsupported in direct-raster mode.
  return null;
}

// ---- Transform / resize helpers ------------------------------------------

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
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
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

// Lossless 90°/180°/270° rotation around the bounding-box centre.
// Each source pixel maps to exactly one destination pixel — repeated rotations
// are perfectly reversible, so the image never distorts.
function rotateAbsPixels(abs: [number, number][], angleDeg: number): [number, number][] {
  if (!abs.length) return abs;
  const a = ((Math.round(angleDeg / 90) * 90) % 360 + 360) % 360;
  if (a === 0) return abs;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
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

function transformElement(
  el: CanvasElement,
  op: 'flip-h' | 'flip-v' | 'rotate',
  angleDeg?: number
): CanvasElement {
  // Text transforms are not yet supported.
  if (el.type === 'text') return el;

  // Symmetric primitives short-circuit.
  if (el.type === 'circle') return el;
  if (el.type === 'rect' && (op === 'flip-h' || op === 'flip-v')) return el;

  // Rect rotated by multiples of 90° stays a rect (90/270 swap dims).
  if (el.type === 'rect' && op === 'rotate' && angleDeg !== undefined) {
    const a = ((angleDeg % 360) + 360) % 360;
    if (a === 0 || a === 180) return el;
    if (a === 90 || a === 270) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const newW = Math.abs(el.height);
      const newH = Math.abs(el.width);
      return {
        ...el,
        width: newW,
        height: newH,
        x: Math.round(cx - newW / 2),
        y: Math.round(cy - newH / 2),
      };
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

function resizeElement(
  el: CanvasElement,
  nxIn: number,
  nyIn: number,
  nwIn: number,
  nhIn: number
): CanvasElement {
  const nw = Math.max(1, Math.round(nwIn));
  const nh = Math.max(1, Math.round(nhIn));
  const nx = Math.round(nxIn);
  const ny = Math.round(nyIn);

  if (el.type === 'rect') {
    return { ...el, x: nx, y: ny, width: nw, height: nh };
  }

  if (el.type === 'circle') {
    // Keep the centre fixed — the caller is expected to pass bounds that are
    // already centred on the circle's current centre. This prevents the circle
    // from drifting while the user drags a handle.
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

  if (el.type === 'pixels') {
    // Resizing 1-bit hand-drawn art is destructive (no anti-aliasing fallback),
    // so we never resample \u2014 the element is only translated.
    return { ...el, x: nx, y: ny };
  }

  if (el.type === 'text') {
    return { ...el, x: nx, y: ny };
  }

  if (el.type === 'bitmap') {
    return { ...el, x: nx, y: ny };
  }

  return el;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_DISPLAY':
      return { ...state, display: action.payload };

    case 'ADD_ELEMENT': {
      const targetLayer = state.layers.find((l) => l.id === state.selectedLayerId) ?? state.layers[0];
      return {
        ...state,
        layers: mapElementsInLayer(state.layers, targetLayer.id, (els) => [...els, action.payload]),
        selectedId: action.payload.id,
      };
    }

    case 'UPDATE_ELEMENT':
      return {
        ...state,
        layers: mapAllElements(state.layers, (el) =>
          el.id === action.payload.id ? (action.payload as CanvasElement) : el
        ),
      };

    case 'DELETE_ELEMENT':
      return {
        ...state,
        layers: state.layers.map((l) => ({
          ...l,
          elements: l.elements.filter((el) => el.id !== action.payload),
        })),
        selectedId: state.selectedId === action.payload ? null : state.selectedId,
      };

    case 'SELECT_ELEMENT': {
      if (action.payload == null) return { ...state, selectedId: null };
      const found = findElement(state.layers, action.payload);
      return {
        ...state,
        selectedId: action.payload,
        selectedLayerId: found ? found.layer.id : state.selectedLayerId,
      };
    }

    case 'MOVE_ELEMENT':
      return {
        ...state,
        layers: mapAllElements(state.layers, (el) => {
          if (el.id !== action.payload.id) return el;
          if (el.type === 'line' && action.payload.x2 !== undefined && action.payload.y2 !== undefined) {
            return { ...el, x: action.payload.x, y: action.payload.y, x2: action.payload.x2, y2: action.payload.y2 };
          }
          return { ...el, x: action.payload.x, y: action.payload.y };
        }),
      };

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };

    case 'SET_SNAP':
      return { ...state, snapSize: Math.max(0, action.payload) };

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(1, Math.min(20, action.payload)) };

    case 'LOAD_PROJECT': {
      const p = action.payload;
      // Migrate legacy projects with a flat elements array into a single layer
      let layers: Layer[];
      if (p.layers && p.layers.length > 0) {
        layers = p.layers;
      } else if (p.elements) {
        layers = [makeLayer('main', p.elements)];
      } else {
        layers = [makeLayer('main')];
      }
      return {
        ...state,
        display: p.display,
        layers,
        selectedLayerId: layers[0].id,
        selectedId: null,
        erasedPixels: p.erasedPixels ?? [],
      };
    }

    case 'REORDER_ELEMENT': {
      const found = findElement(state.layers, action.payload.id);
      if (!found) return state;
      const layer = found.layer;
      const idx = layer.elements.findIndex((el) => el.id === action.payload.id);
      const swap = action.payload.direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= layer.elements.length) return state;
      const newElements = [...layer.elements];
      [newElements[idx], newElements[swap]] = [newElements[swap], newElements[idx]];
      return {
        ...state,
        layers: state.layers.map((l) => (l.id === layer.id ? { ...l, elements: newElements } : l)),
      };
    }

    case 'DUPLICATE_ELEMENT': {
      const found = findElement(state.layers, action.payload);
      if (!found) return state;
      const source = found.element;
      const newEl = { ...source, id: `${source.type}_${Date.now()}`, x: source.x + 5, y: source.y + 5 };
      return {
        ...state,
        layers: mapElementsInLayer(state.layers, found.layer.id, (els) => [...els, newEl]),
        selectedId: newEl.id,
      };
    }

    case 'SET_TOOL':
      return { ...state, activeTool: action.payload };

    case 'ADD_PIXELS': {
      return {
        ...state,
        layers: mapAllElements(state.layers, (el) => {
          if (el.id !== action.payload.id || el.type !== 'pixels') return el;
          const existing = new Set(el.pixels.map(([px, py]) => `${px},${py}`));
          const newPixels = action.payload.pixels.filter(([px, py]) => !existing.has(`${px},${py}`));
          return { ...el, pixels: [...el.pixels, ...newPixels] };
        }),
      };
    }

    case 'ERASE_PIXEL': {
      const { x, y } = action.payload;
      const newLayers = state.layers.map((l) => ({ ...l, elements: [...l.elements] }));

      // Top-most hit wins (same visual stacking as hit-testing/select).
      for (let li = newLayers.length - 1; li >= 0; li--) {
        const layer = newLayers[li];
        if (!layer.visible) continue;

        for (let ei = layer.elements.length - 1; ei >= 0; ei--) {
          const el = layer.elements[ei];
          if (!el.visible) continue;

          if (el.type === 'pixels') {
            const filtered = el.pixels.filter(([px, py]) => (el.x + px) !== x || (el.y + py) !== y);
            if (filtered.length === el.pixels.length) continue;
            layer.elements[ei] = { ...el, pixels: filtered };
            return {
              ...state,
              layers: newLayers,
              erasedPixels: state.erasedPixels.filter(([px, py]) => px !== x || py !== y),
            };
          }

          const raster = rasterizeElementToPixels(el);
          if (!raster) continue;
          const hit = raster.pixels.some(([px, py]) => raster.x + px === x && raster.y + py === y);
          if (!hit) continue;

          const nextPixels = raster.pixels.filter(([px, py]) => raster.x + px !== x || raster.y + py !== y);
          layer.elements[ei] = {
            id: el.id,
            type: 'pixels',
            x: raster.x,
            y: raster.y,
            visible: el.visible,
            strokeWidth: 1,
            pixels: nextPixels,
          };

          return {
            ...state,
            layers: newLayers,
            erasedPixels: state.erasedPixels.filter(([px, py]) => px !== x || py !== y),
          };
        }
      }

      return state;
    }

    case 'CLEAR_ERASED':
      return { ...state, erasedPixels: [] };

    case 'TRANSFORM_ELEMENT': {
      const { id, op, angle } = action.payload;
      return {
        ...state,
        layers: mapAllElements(state.layers, (el) =>
          el.id === id ? transformElement(el, op, angle) : el
        ),
      };
    }

    case 'RESIZE_ELEMENT': {
      const { id, x, y, width, height } = action.payload;
      return {
        ...state,
        layers: mapAllElements(state.layers, (el) =>
          el.id === id ? resizeElement(el, x, y, width, height) : el
        ),
      };
    }

    // ---- LAYER ACTIONS ----
    case 'ADD_LAYER': {
      const baseName = action.payload?.name?.trim() || `layer ${state.layers.length + 1}`;
      const layer = makeLayer(baseName);
      return { ...state, layers: [...state.layers, layer], selectedLayerId: layer.id };
    }

    case 'DELETE_LAYER': {
      if (state.layers.length <= 1) return state;
      const newLayers = state.layers.filter((l) => l.id !== action.payload);
      const selectedLayerId =
        state.selectedLayerId === action.payload ? newLayers[0].id : state.selectedLayerId;
      // Drop selection if it was in the deleted layer
      const stillHasSelected =
        state.selectedId && newLayers.some((l) => l.elements.some((e) => e.id === state.selectedId));
      return {
        ...state,
        layers: newLayers,
        selectedLayerId,
        selectedId: stillHasSelected ? state.selectedId : null,
      };
    }

    case 'RENAME_LAYER':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.payload.id ? { ...l, name: action.payload.name } : l
        ),
      };

    case 'TOGGLE_LAYER_VISIBLE':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.payload ? { ...l, visible: !l.visible } : l
        ),
      };

    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.payload };

    case 'REORDER_LAYER': {
      const idx = state.layers.findIndex((l) => l.id === action.payload.id);
      if (idx === -1) return state;
      const swap = action.payload.direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= state.layers.length) return state;
      const newLayers = [...state.layers];
      [newLayers[idx], newLayers[swap]] = [newLayers[swap], newLayers[idx]];
      return { ...state, layers: newLayers };
    }

    case 'MOVE_ELEMENT_TO_LAYER': {
      const found = findElement(state.layers, action.payload.elementId);
      if (!found || found.layer.id === action.payload.layerId) return state;
      const el = found.element;
      return {
        ...state,
        layers: state.layers.map((l) => {
          if (l.id === found.layer.id) return { ...l, elements: l.elements.filter((e) => e.id !== el.id) };
          if (l.id === action.payload.layerId) return { ...l, elements: [...l.elements, el] };
          return l;
        }),
      };
    }

    default:
      return state;
  }
}

const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// Utility exposed for components: snap a coordinate to the current grid.
export function snapCoord(v: number, snapSize: number): number {
  if (snapSize <= 0) return v;
  return Math.round(v / snapSize) * snapSize;
}

// Snap a coordinate but clamp to display bounds [0, maxExclusive-1].
export function snapCoordClamped(v: number, snapSize: number, maxExclusive: number): number {
  const s = snapSize > 0 ? Math.round(v / snapSize) * snapSize : v;
  return Math.max(0, Math.min(maxExclusive - 1, s));
}

// Utility: get a flat list of all elements (with their owning layer) in render order.
export function getAllElements(state: AppState): { element: CanvasElement; layer: Layer }[] {
  const out: { element: CanvasElement; layer: Layer }[] = [];
  for (const l of state.layers) {
    for (const e of l.elements) out.push({ element: e, layer: l });
  }
  return out;
}
