import type { AppState, Action } from '../types';
import type { CanvasElement, WidgetRefElement, GroupElement } from '../../types';
import {
  mapAllElements, mapElementsInLayer, findElement,
  addElementToActiveContainer,
} from '../helpers';
import { rasterizeElementToPixels } from '../transforms';
import { transformElement, resizeElement } from '../transforms';
import { uid } from '../../utils/uid';

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
        selectedIds: state.selectedIds.filter((id) => id !== action.payload),
      };
    }

    case 'SELECT_ELEMENT': {
      if (action.payload == null) return { ...state, selectedId: null, selectedIds: [] };
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
        selectedIds: [action.payload],
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
      const newEl = { ...source, id: uid(source.type), x: source.x + 5, y: source.y + 5 };
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
          newEls[ei] = { id: el.id, type: 'pixels', x: raster.x, y: raster.y, visible: el.visible, strokeWidth: 1, pixels: nextPixels, inverted: el.inverted || undefined };
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
          layer.elements[ei] = { id: el.id, type: 'pixels', x: raster.x, y: raster.y, visible: el.visible, strokeWidth: 1, pixels: nextPixels, inverted: el.inverted || undefined };
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

    case 'SELECT_ELEMENT_MULTI': {
      const id = action.payload;
      const found = findElement(state, id);
      if (!found || found.kind !== 'layer') return state;
      // If selectedIds is empty but there's a selectedId, seed with it
      let base = state.selectedIds;
      if (base.length === 0 && state.selectedId && state.selectedId !== id) {
        base = [state.selectedId];
      }
      const already = base.includes(id);
      const newIds = already ? base.filter((x) => x !== id) : [...base, id];
      return {
        ...state,
        selectedIds: newIds,
        selectedId: newIds.length > 0 ? newIds[newIds.length - 1] : null,
      };
    }

    case 'SELECT_ELEMENTS': {
      return {
        ...state,
        selectedIds: action.payload,
        selectedId: action.payload.length > 0 ? action.payload[action.payload.length - 1] : null,
      };
    }

    case 'GROUP_ELEMENTS': {
      const ids = state.selectedIds;
      if (ids.length < 2) return state;
      // All selected must be in the same layer
      const firstFound = findElement(state, ids[0]);
      if (!firstFound || firstFound.kind !== 'layer') return state;
      const layerId = firstFound.layer.id;
      const layer = state.layers.find((l) => l.id === layerId);
      if (!layer) return state;
      // Collect elements in their current order
      const children: CanvasElement[] = [];
      for (const el of layer.elements) {
        if (ids.includes(el.id)) children.push(el);
      }
      if (children.length < 2) return state;
      // Verify all are in same layer
      for (const id of ids) {
        const f = findElement(state, id);
        if (!f || f.kind !== 'layer' || f.layer.id !== layerId) return state;
      }
      // Compute bounding box
      let minX = Infinity, minY = Infinity;
      for (const c of children) { if (c.x < minX) minX = c.x; if (c.y < minY) minY = c.y; }
      // Offset children relative to group origin
      const relChildren: CanvasElement[] = children.map((c) => {
        if (c.type === 'line') return { ...c, x: c.x - minX, y: c.y - minY, x2: c.x2 - minX, y2: c.y2 - minY };
        return { ...c, x: c.x - minX, y: c.y - minY };
      });
      const groupEl: GroupElement = {
        id: uid('group'), type: 'group', x: minX, y: minY,
        visible: true, strokeWidth: 1, children: relChildren,
      };
      // Replace children with group in layer, preserving order (insert at first child position)
      const idSet = new Set(ids);
      const newElements: CanvasElement[] = [];
      let inserted = false;
      for (const el of layer.elements) {
        if (idSet.has(el.id)) {
          if (!inserted) { newElements.push(groupEl); inserted = true; }
        } else {
          newElements.push(el);
        }
      }
      const newLayers = state.layers.map((l) => l.id === layerId ? { ...l, elements: newElements } : l);
      return { ...state, layers: newLayers, selectedId: groupEl.id, selectedIds: [groupEl.id] };
    }

    case 'UNGROUP_ELEMENT': {
      const id = action.payload;
      const found = findElement(state, id);
      if (!found || found.kind !== 'layer') return state;
      const el = found.element;
      if (el.type !== 'group') return state;
      const group = el as GroupElement;
      // Restore children to absolute positions
      const absChildren: CanvasElement[] = group.children.map((c) => {
        if (c.type === 'line') return { ...c, x: c.x + group.x, y: c.y + group.y, x2: c.x2 + group.x, y2: c.y2 + group.y };
        return { ...c, x: c.x + group.x, y: c.y + group.y };
      });
      const layerId = found.layer.id;
      const newElements: CanvasElement[] = [];
      for (const e of found.layer.elements) {
        if (e.id === id) newElements.push(...absChildren);
        else newElements.push(e);
      }
      const newLayers = state.layers.map((l) => l.id === layerId ? { ...l, elements: newElements } : l);
      const childIds = absChildren.map((c) => c.id);
      return { ...state, layers: newLayers, selectedId: childIds[0] ?? null, selectedIds: childIds };
    }

    case 'FLATTEN_ELEMENTS': {
      const ids = state.selectedIds;
      if (ids.length < 1) return state;
      const firstFound = findElement(state, ids[0]);
      if (!firstFound || firstFound.kind !== 'layer') return state;
      const layerId = firstFound.layer.id;
      const layer = state.layers.find((l) => l.id === layerId);
      if (!layer) return state;
      // Collect elements
      const targets: CanvasElement[] = [];
      for (const el of layer.elements) {
        if (ids.includes(el.id)) targets.push(el);
      }
      if (targets.length === 0) return state;
      // For a single group, flatten its children
      const toFlatten = (targets.length === 1 && targets[0].type === 'group')
        ? (targets[0] as GroupElement).children.map((c) => {
          if (c.type === 'line') return { ...c, x: c.x + targets[0].x, y: c.y + targets[0].y, x2: c.x2 + targets[0].x, y2: c.y2 + targets[0].y };
          return { ...c, x: c.x + targets[0].x, y: c.y + targets[0].y };
        })
        : targets;
      // Rasterize all into pixel sets
      const normalPixels: Set<string> = new Set();
      const invertedPixels: Set<string> = new Set();
      function flattenEl(el: CanvasElement) {
        if (el.type === 'group') {
          for (const c of (el as GroupElement).children) {
            const abs = c.type === 'line'
              ? { ...c, x: c.x + el.x, y: c.y + el.y, x2: c.x2 + el.x, y2: c.y2 + el.y }
              : { ...c, x: c.x + el.x, y: c.y + el.y };
            flattenEl(abs as CanvasElement);
          }
          return;
        }
        const inv = !!el.inverted;
        const raster = rasterizeElementToPixels(el);
        if (!raster) return;
        const target = inv ? invertedPixels : normalPixels;
        for (const [px, py] of raster.pixels) {
          target.add(`${raster.x + px},${raster.y + py}`);
        }
      }
      for (const el of toFlatten) flattenEl(el);
      // Build result elements
      const results: CanvasElement[] = [];
      if (normalPixels.size > 0) {
        const pts = [...normalPixels].map((s) => s.split(',').map(Number) as [number, number]);
        let mx = Infinity, my = Infinity;
        for (const [x, y] of pts) { if (x < mx) mx = x; if (y < my) my = y; }
        const rel: [number, number][] = pts.map(([x, y]) => [x - mx, y - my]);
        results.push({ id: uid('pixels'), type: 'pixels', x: mx, y: my, visible: true, strokeWidth: 1, pixels: rel });
      }
      if (invertedPixels.size > 0) {
        const pts = [...invertedPixels].map((s) => s.split(',').map(Number) as [number, number]);
        let mx = Infinity, my = Infinity;
        for (const [x, y] of pts) { if (x < mx) mx = x; if (y < my) my = y; }
        const rel: [number, number][] = pts.map(([x, y]) => [x - mx, y - my]);
        results.push({ id: uid('pixels'), type: 'pixels', x: mx, y: my, visible: true, strokeWidth: 1, pixels: rel, inverted: true });
      }
      if (results.length === 0) return state;
      // Replace targets with results
      const idSet = new Set(ids);
      const newElements: CanvasElement[] = [];
      let inserted = false;
      for (const el of layer.elements) {
        if (idSet.has(el.id)) {
          if (!inserted) { newElements.push(...results); inserted = true; }
        } else {
          newElements.push(el);
        }
      }
      const newLayers = state.layers.map((l) => l.id === layerId ? { ...l, elements: newElements } : l);
      return { ...state, layers: newLayers, selectedId: results[0].id, selectedIds: results.map((r) => r.id) };
    }

    default:
      return state;
  }
}
