import type { AppState, Action } from '../types';
import type { CanvasElement, WidgetRefElement } from '../../types';
import {
  mapAllElements, mapElementsInLayer, findElement,
  addElementToActiveContainer,
} from '../helpers';
import { rasterizeElementToPixels } from '../transforms';
import { transformElement, resizeElement } from '../transforms';

export function reduceElement(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_ELEMENT': {
      const patch = addElementToActiveContainer(state, action.payload);
      return { ...state, ...patch, selectedId: action.payload.id, editor: { ...state.editor, selectedWidgetId: null } };
    }

    case 'UPDATE_ELEMENT': {
      const { layers, animations } = mapAllElements(state, (el) =>
        el.id === action.payload.id ? (action.payload as CanvasElement) : el
      );
      return { ...state, layers, animations };
    }

    case 'DELETE_ELEMENT': {
      const layers = state.layers.map((l) => ({ ...l, elements: l.elements.filter((el) => el.id !== action.payload) }));
      const animations = state.animations.map((a) => ({
        ...a,
        frames: a.frames.map((f) => ({ ...f, elements: f.elements.filter((el) => el.id !== action.payload) })),
      }));
      return {
        ...state, layers, animations,
        selectedId: state.selectedId === action.payload ? null : state.selectedId,
      };
    }

    case 'SELECT_ELEMENT': {
      if (action.payload == null) return { ...state, selectedId: null };
      const found = findElement(state, action.payload);
      const el = found?.kind === 'layer'
        ? found.layer.elements.find((e) => e.id === action.payload)
        : undefined;
      const keepWidget = el?.type === 'widgetRef'
        ? (el as WidgetRefElement).widgetId
        : null;
      return {
        ...state,
        selectedId: action.payload,
        selectedLayerId: found && found.kind === 'layer' ? found.layer.id : state.selectedLayerId,
        editor: { ...state.editor, selectedWidgetId: keepWidget },
      };
    }

    case 'MOVE_ELEMENT': {
      const { layers, animations } = mapAllElements(state, (el) => {
        if (el.id !== action.payload.id) return el;
        if (el.type === 'line' && action.payload.x2 !== undefined && action.payload.y2 !== undefined) {
          return { ...el, x: action.payload.x, y: action.payload.y, x2: action.payload.x2, y2: action.payload.y2 };
        }
        return { ...el, x: action.payload.x, y: action.payload.y };
      });
      return { ...state, layers, animations };
    }

    case 'REORDER_ELEMENT': {
      const found = findElement(state, action.payload.id);
      if (!found) return state;
      if (found.kind === 'layer') {
        const layer = found.layer;
        const idx = layer.elements.findIndex((el) => el.id === action.payload.id);
        const swap = action.payload.direction === 'up' ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= layer.elements.length) return state;
        const newElements = [...layer.elements];
        [newElements[idx], newElements[swap]] = [newElements[swap], newElements[idx]];
        return { ...state, layers: state.layers.map((l) => (l.id === layer.id ? { ...l, elements: newElements } : l)) };
      }
      const { animation, frame } = found;
      const idx = frame.elements.findIndex((el) => el.id === action.payload.id);
      const swap = action.payload.direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= frame.elements.length) return state;
      const newEls = [...frame.elements];
      [newEls[idx], newEls[swap]] = [newEls[swap], newEls[idx]];
      return {
        ...state,
        animations: state.animations.map((a) => a.id !== animation.id ? a : {
          ...a, frames: a.frames.map((f) => f.id !== frame.id ? f : { ...f, elements: newEls }),
        }),
      };
    }

    case 'DUPLICATE_ELEMENT': {
      const found = findElement(state, action.payload);
      if (!found) return state;
      const source = found.element;
      const newEl = { ...source, id: `${source.type}_${Date.now()}`, x: source.x + 5, y: source.y + 5 };
      if (found.kind === 'layer') {
        return {
          ...state,
          layers: mapElementsInLayer(state.layers, found.layer.id, (els) => [...els, newEl]),
          selectedId: newEl.id,
        };
      }
      return {
        ...state,
        animations: state.animations.map((a) => a.id !== found.animation.id ? a : {
          ...a, frames: a.frames.map((f) => f.id !== found.frame.id ? f : { ...f, elements: [...f.elements, newEl] }),
        }),
        selectedId: newEl.id,
      };
    }

    case 'SET_TOOL':
      return { ...state, activeTool: action.payload };

    case 'ADD_PIXELS': {
      const apply = (el: CanvasElement): CanvasElement => {
        if (el.id !== action.payload.id || el.type !== 'pixels') return el;
        const existing = new Set(el.pixels.map(([px, py]) => `${px},${py}`));
        const newPixels = action.payload.pixels.filter(([px, py]) => !existing.has(`${px},${py}`));
        return { ...el, pixels: [...el.pixels, ...newPixels] };
      };
      const { layers, animations } = mapAllElements(state, apply);
      return { ...state, layers, animations };
    }

    case 'ERASE_PIXEL': {
      const { x, y } = action.payload;

      if (state.editor.mode === 'animation' && state.editor.activeAnimationId && state.editor.activeFrameId) {
        const animIdx = state.animations.findIndex((a) => a.id === state.editor.activeAnimationId);
        if (animIdx < 0) return state;
        const anim = state.animations[animIdx];
        const frameIdx = anim.frames.findIndex((f) => f.id === state.editor.activeFrameId);
        if (frameIdx < 0) return state;
        const frame = anim.frames[frameIdx];
        const newEls = [...frame.elements];
        for (let ei = newEls.length - 1; ei >= 0; ei--) {
          const el = newEls[ei];
          if (!el.visible) continue;
          if (el.type === 'pixels') {
            const filtered = el.pixels.filter(([px, py]) => (el.x + px) !== x || (el.y + py) !== y);
            if (filtered.length === el.pixels.length) continue;
            newEls[ei] = { ...el, pixels: filtered };
            break;
          }
          const raster = rasterizeElementToPixels(el);
          if (!raster) continue;
          const hit = raster.pixels.some(([px, py]) => raster.x + px === x && raster.y + py === y);
          if (!hit) continue;
          const nextPixels = raster.pixels.filter(([px, py]) => raster.x + px !== x || raster.y + py !== y);
          newEls[ei] = { id: el.id, type: 'pixels', x: raster.x, y: raster.y, visible: el.visible, strokeWidth: 1, pixels: nextPixels };
          break;
        }
        const newAnim = { ...anim, frames: anim.frames.map((f, i) => i === frameIdx ? { ...frame, elements: newEls } : f) };
        const newAnims = [...state.animations];
        newAnims[animIdx] = newAnim;
        return { ...state, animations: newAnims };
      }

      const newLayers = state.layers.map((l) => ({ ...l, elements: [...l.elements] }));
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
            return { ...state, layers: newLayers, erasedPixels: state.erasedPixels.filter(([px, py]) => px !== x || py !== y) };
          }
          const raster = rasterizeElementToPixels(el);
          if (!raster) continue;
          const hit = raster.pixels.some(([px, py]) => raster.x + px === x && raster.y + py === y);
          if (!hit) continue;
          const nextPixels = raster.pixels.filter(([px, py]) => raster.x + px !== x || raster.y + py !== y);
          layer.elements[ei] = { id: el.id, type: 'pixels', x: raster.x, y: raster.y, visible: el.visible, strokeWidth: 1, pixels: nextPixels };
          return { ...state, layers: newLayers, erasedPixels: state.erasedPixels.filter(([px, py]) => px !== x || py !== y) };
        }
      }
      return state;
    }

    case 'CLEAR_ERASED':
      return { ...state, erasedPixels: [] };

    case 'TRANSFORM_ELEMENT': {
      const { id, op, angle } = action.payload;
      const { layers, animations } = mapAllElements(state, (el) =>
        el.id === id ? transformElement(el, op, angle) : el
      );
      return { ...state, layers, animations };
    }

    case 'RESIZE_ELEMENT': {
      const { id, x, y, width, height } = action.payload;
      const { layers, animations } = mapAllElements(state, (el) =>
        el.id === id ? resizeElement(el, x, y, width, height) : el
      );
      return { ...state, layers, animations };
    }

    default:
      return state;
  }
}
