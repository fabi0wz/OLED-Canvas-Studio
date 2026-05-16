import type { CanvasElement, Layer, Screen } from '../types';
import type { AppState } from './types';

/** Snap a coordinate to the current grid. */
export function snapCoord(v: number, snapSize: number): number {
  if (snapSize <= 0) return v;
  return Math.round(v / snapSize) * snapSize;
}

/** Snap a coordinate but clamp to display bounds [0, maxExclusive-1]. */
export function snapCoordClamped(v: number, snapSize: number, maxExclusive: number): number {
  const s = snapSize > 0 ? Math.round(v / snapSize) * snapSize : v;
  return Math.max(0, Math.min(maxExclusive - 1, s));
}

/** Get a flat list of all elements (with their owning layer) in render order. */
export function getAllElements(state: AppState): { element: CanvasElement; layer: Layer }[] {
  const out: { element: CanvasElement; layer: Layer }[] = [];
  for (const l of state.layers) {
    for (const e of l.elements) out.push({ element: e, layer: l });
  }
  return out;
}

/**
 * Elements actually shown in the editor, in render (back-to-front) order,
 * for the current scene mode. In animation mode the active frame's elements
 * are included; static layers are still shown beneath as the scene base.
 */
export function getAllElementsForRender(state: AppState): { element: CanvasElement; layer?: Layer }[] {
  const out: { element: CanvasElement; layer?: Layer }[] = [];
  for (const l of state.layers) if (l.visible) for (const e of l.elements) out.push({ element: e, layer: l });
  if (state.editor.mode === 'animation' && state.editor.activeAnimationId && state.editor.activeFrameId) {
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    const frame = anim?.frames.find((f) => f.id === state.editor.activeFrameId);
    if (anim && anim.visible && frame) {
      for (const e of frame.elements) out.push({ element: e });
    }
  }
  return out;
}

/**
 * Returns the full list of project screens with the active screen's live
 * working state committed in. Use this when serializing or generating code.
 */
export function getAllScreensCommitted(state: AppState): Screen[] {
  return state.screens.map((s) => (
    s.id === state.activeScreenId
      ? { ...s, layers: state.layers, animations: state.animations, widgets: state.widgets, erasedPixels: state.erasedPixels }
      : s
  ));
}
