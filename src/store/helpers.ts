import type {
  CanvasElement, Layer, FrameAnimation, Frame,
  ProceduralWidget, Screen, WidgetRefElement, GroupElement,
} from '../types';
import type { AppState } from './types';
import { uid } from './initialState';

/** Snapshot the live working state back into the active screen entry. */
export function commitActive(state: AppState): Screen[] {
  return state.screens.map((s) => (
    s.id === state.activeScreenId
      ? { ...s, layers: state.layers, animations: state.animations, widgets: state.widgets, erasedPixels: state.erasedPixels }
      : s
  ));
}

/** Deep-clone a screen, regenerating ids for everything inside. */
export function cloneScreen(src: Screen, newName: string): Screen {
  const idMap = new Map<string, string>();
  const remap = (oldId: string, prefix: string) => {
    const fresh = uid(prefix);
    idMap.set(oldId, fresh);
    return fresh;
  };

  const newAnims: FrameAnimation[] = src.animations.map((a) => ({
    ...a,
    id: remap(a.id, 'anim'),
    frames: a.frames.map((f) => ({
      ...f,
      id: uid('frame'),
      elements: f.elements.map((el) => ({ ...el, id: uid(el.type) })),
    })),
  }));
  const newWidgets: ProceduralWidget[] = src.widgets.map((w) => ({
    ...w, id: remap(w.id, 'widget'),
  }));

  const newLayers: Layer[] = src.layers.map((l) => ({
    ...l,
    id: uid('layer'),
    elements: l.elements.map((el) => {
      if (el.type === 'animationRef') {
        return { ...el, id: uid('animref'), animationId: idMap.get(el.animationId) ?? el.animationId };
      }
      if (el.type === 'widgetRef') {
        return { ...el, id: uid('widgetref'), widgetId: idMap.get(el.widgetId) ?? el.widgetId };
      }
      if (el.type === 'group') {
        return { ...el, id: uid('group'), children: (el as GroupElement).children.map((c) => ({ ...c, id: uid(c.type) })) };
      }
      return { ...el, id: uid(el.type) };
    }),
  }));

  return {
    id: uid('screen'),
    name: newName,
    transition: src.transition,
    layers: newLayers,
    animations: newAnims,
    widgets: newWidgets,
    erasedPixels: src.erasedPixels.map(([x, y]) => [x, y] as [number, number]),
  };
}

/** Insert a layer-level reference element into the selected (or first) layer. */
export function addRefToActiveLayer(layers: Layer[], selectedLayerId: string, ref: CanvasElement): Layer[] {
  const targetId = layers.find((l) => l.id === selectedLayerId)?.id ?? layers[0]?.id;
  if (!targetId) return layers;
  return layers.map((l) => l.id === targetId ? { ...l, elements: [...l.elements, ref] } : l);
}

/** Strip any AnimationRef/WidgetRef elements that point at the given id from every layer and frame. */
export function stripRefs(
  state: AppState,
  kind: 'animationRef' | 'widgetRef',
  targetId: string,
): { layers: Layer[]; animations: FrameAnimation[] } {
  const filter = (els: CanvasElement[]) => els.filter((e) =>
    !(e.type === kind && (e.type === 'animationRef' ? e.animationId === targetId : (e as WidgetRefElement).widgetId === targetId))
  );
  return {
    layers: state.layers.map((l) => ({ ...l, elements: filter(l.elements) })),
    animations: state.animations.map((a) => ({ ...a, frames: a.frames.map((f) => ({ ...f, elements: filter(f.elements) })) })),
  };
}

/** Map elements inside a specific layer. */
export function mapElementsInLayer(
  layers: Layer[],
  layerId: string,
  fn: (elements: CanvasElement[]) => CanvasElement[],
): Layer[] {
  return layers.map((l) => (l.id === layerId ? { ...l, elements: fn(l.elements) } : l));
}

/** Map every element in every layer (including children of groups). */
export function mapAllLayerElements(
  layers: Layer[],
  fn: (el: CanvasElement, layer: Layer) => CanvasElement,
): Layer[] {
  function mapEl(el: CanvasElement, layer: Layer): CanvasElement {
    const mapped = fn(el, layer);
    if (mapped.type === 'group') {
      return { ...mapped, children: (mapped as GroupElement).children.map((c) => fn(c, layer)) } as CanvasElement;
    }
    return mapped;
  }
  return layers.map((l) => ({ ...l, elements: l.elements.map((el) => mapEl(el, l)) }));
}

/** Map every element in every frame of every animation. */
export function mapAllFrameElements(
  animations: FrameAnimation[],
  fn: (el: CanvasElement, frame: Frame, animation: FrameAnimation) => CanvasElement,
): FrameAnimation[] {
  return animations.map((a) => ({
    ...a,
    frames: a.frames.map((f) => ({ ...f, elements: f.elements.map((el) => fn(el, f, a)) })),
  }));
}

/** Apply the same per-element transform across both static layers and animation frames. */
export function mapAllElements(
  state: AppState,
  fn: (el: CanvasElement) => CanvasElement,
): { layers: Layer[]; animations: FrameAnimation[] } {
  return {
    layers: mapAllLayerElements(state.layers, fn),
    animations: mapAllFrameElements(state.animations, fn),
  };
}

/** Find an element by id, searching static layers then animation frames. */
export function findElement(state: AppState, id: string):
  | { kind: 'layer'; element: CanvasElement; layer: Layer }
  | { kind: 'frame'; element: CanvasElement; animation: FrameAnimation; frame: Frame }
  | null {
  for (const l of state.layers) {
    const el = l.elements.find((e) => e.id === id);
    if (el) return { kind: 'layer', element: el, layer: l };
  }
  for (const a of state.animations) {
    for (const f of a.frames) {
      const el = f.elements.find((e) => e.id === id);
      if (el) return { kind: 'frame', element: el, animation: a, frame: f };
    }
  }
  return null;
}

/** Push a new element into the currently active container (layer or frame). */
export function addElementToActiveContainer(state: AppState, el: CanvasElement): Partial<AppState> {
  if (state.editor.mode === 'animation' && state.editor.activeAnimationId && state.editor.activeFrameId) {
    return {
      animations: state.animations.map((a) =>
        a.id !== state.editor.activeAnimationId ? a : {
          ...a,
          frames: a.frames.map((f) => f.id !== state.editor.activeFrameId ? f : { ...f, elements: [...f.elements, el] }),
        }
      ),
    };
  }
  const targetLayer = state.layers.find((l) => l.id === state.selectedLayerId) ?? state.layers[0];
  return { layers: mapElementsInLayer(state.layers, targetLayer.id, (els) => [...els, el]) };
}

/** Elements currently visible for hit testing in the active editing context. */
export function getEditableElementsInOrder(state: AppState): CanvasElement[] {
  if (state.editor.mode === 'animation' && state.editor.activeAnimationId && state.editor.activeFrameId) {
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    const frame = anim?.frames.find((f) => f.id === state.editor.activeFrameId);
    return frame ? frame.elements : [];
  }
  const out: CanvasElement[] = [];
  for (const l of state.layers) for (const e of l.elements) out.push(e);
  return out;
}
