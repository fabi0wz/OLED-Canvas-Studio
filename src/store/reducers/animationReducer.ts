import type { AnimationRefElement, Frame } from '../../types';
import type { AppState, Action } from '../types';
import { uid, makeAnimation, makeFrame } from '../initialState';
import { addRefToActiveLayer, stripRefs } from '../helpers';

export function reduceAnimation(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_ANIMATION': {
      const baseName = action.payload?.name?.trim() || `animation ${state.animations.length + 1}`;
      const anim = makeAnimation(baseName);
      const ref: AnimationRefElement = {
        id: uid('animref'), type: 'animationRef', x: anim.x, y: anim.y,
        visible: true, strokeWidth: 1, animationId: anim.id,
      };
      return {
        ...state,
        animations: [...state.animations, anim],
        layers: addRefToActiveLayer(state.layers, state.selectedLayerId, ref),
        editor: { ...state.editor, mode: 'animation', activeAnimationId: anim.id, activeFrameId: anim.frames[0].id, selectedWidgetId: null },
        selectedId: ref.id,
      };
    }

    case 'DELETE_ANIMATION': {
      const newAnims = state.animations.filter((a) => a.id !== action.payload);
      const wasActive = state.editor.activeAnimationId === action.payload;
      const { layers } = stripRefs(state, 'animationRef', action.payload);
      return {
        ...state,
        animations: newAnims,
        layers,
        editor: {
          ...state.editor,
          activeAnimationId: wasActive ? (newAnims[0]?.id ?? null) : state.editor.activeAnimationId,
          activeFrameId: wasActive ? (newAnims[0]?.frames[0]?.id ?? null) : state.editor.activeFrameId,
        },
      };
    }

    case 'RENAME_ANIMATION':
      return { ...state, animations: state.animations.map((a) => a.id === action.payload.id ? { ...a, name: action.payload.name } : a) };

    case 'TOGGLE_ANIMATION_VISIBLE':
      return { ...state, animations: state.animations.map((a) => a.id === action.payload ? { ...a, visible: !a.visible } : a) };

    case 'SELECT_ANIMATION': {
      const anim = state.animations.find((a) => a.id === action.payload);
      return {
        ...state,
        editor: {
          ...state.editor,
          activeAnimationId: action.payload,
          activeFrameId: anim?.frames[0]?.id ?? null,
          selectedWidgetId: null,
        },
        selectedId: null,
      };
    }

    case 'UPDATE_ANIMATION': {
      const changes = action.payload.changes;
      const newAnimations = state.animations.map((a) => a.id === action.payload.id ? { ...a, ...changes } : a);
      const newLayers = (changes.x !== undefined || changes.y !== undefined)
        ? state.layers.map((l) => ({
            ...l,
            elements: l.elements.map((e) =>
              e.type === 'animationRef' && e.animationId === action.payload.id
                ? { ...e, x: changes.x ?? e.x, y: changes.y ?? e.y }
                : e
            ),
          }))
        : state.layers;
      return { ...state, animations: newAnimations, layers: newLayers };
    }

    case 'ADD_FRAME': {
      const newFrame = makeFrame();
      return {
        ...state,
        animations: state.animations.map((a) => a.id !== action.payload.animationId ? a : { ...a, frames: [...a.frames, newFrame] }),
        editor: { ...state.editor, activeAnimationId: action.payload.animationId, activeFrameId: newFrame.id },
        selectedId: null,
      };
    }

    case 'DUPLICATE_FRAME': {
      const anim = state.animations.find((a) => a.id === action.payload.animationId);
      const src = anim?.frames.find((f) => f.id === action.payload.frameId);
      if (!anim || !src) return state;
      const cloned: Frame = {
        id: uid('frame'),
        durationMs: src.durationMs,
        elements: src.elements.map((el) => ({ ...el, id: uid(el.type) })),
      };
      const idx = anim.frames.findIndex((f) => f.id === src.id);
      const newFrames = [...anim.frames.slice(0, idx + 1), cloned, ...anim.frames.slice(idx + 1)];
      return {
        ...state,
        animations: state.animations.map((a) => a.id === anim.id ? { ...a, frames: newFrames } : a),
        editor: { ...state.editor, activeAnimationId: anim.id, activeFrameId: cloned.id },
      };
    }

    case 'DELETE_FRAME': {
      const anim = state.animations.find((a) => a.id === action.payload.animationId);
      if (!anim || anim.frames.length <= 1) return state;
      const idx = anim.frames.findIndex((f) => f.id === action.payload.frameId);
      const newFrames = anim.frames.filter((f) => f.id !== action.payload.frameId);
      const nextActiveId = state.editor.activeFrameId === action.payload.frameId
        ? newFrames[Math.max(0, idx - 1)]?.id ?? null
        : state.editor.activeFrameId;
      return {
        ...state,
        animations: state.animations.map((a) => a.id === anim.id ? { ...a, frames: newFrames } : a),
        editor: { ...state.editor, activeFrameId: nextActiveId },
      };
    }

    case 'REORDER_FRAME': {
      const anim = state.animations.find((a) => a.id === action.payload.animationId);
      if (!anim) return state;
      const idx = anim.frames.findIndex((f) => f.id === action.payload.frameId);
      const swap = action.payload.direction === 'left' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= anim.frames.length) return state;
      const newFrames = [...anim.frames];
      [newFrames[idx], newFrames[swap]] = [newFrames[swap], newFrames[idx]];
      return { ...state, animations: state.animations.map((a) => a.id === anim.id ? { ...a, frames: newFrames } : a) };
    }

    case 'SELECT_FRAME':
      return {
        ...state,
        editor: { ...state.editor, activeAnimationId: action.payload.animationId, activeFrameId: action.payload.frameId },
        selectedId: null,
      };

    case 'UPDATE_FRAME':
      return {
        ...state,
        animations: state.animations.map((a) => a.id !== action.payload.animationId ? a : {
          ...a, frames: a.frames.map((f) => f.id === action.payload.frameId ? { ...f, ...action.payload.changes } : f),
        }),
      };

    default:
      return state;
  }
}
