import type { Layer, ProjectMeta, Screen } from '../../types';
import type { AppState, Action } from '../types';
import { makeLayer, makeScreen } from '../initialState';
import { commitActive, cloneScreen } from '../helpers';
import { uid } from '../../utils/uid';

export function reduceScreen(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_SCREEN': {
      const committed = commitActive(state);
      const baseName = action.payload?.name?.trim() || `Screen ${state.screens.length + 1}`;
      const fresh = makeScreen(baseName);
      return {
        ...state,
        screens: [...committed, fresh],
        activeScreenId: fresh.id,
        layers: fresh.layers,
        animations: fresh.animations,
        widgets: fresh.widgets,
        erasedPixels: fresh.erasedPixels,
        selectedLayerId: fresh.layers[0].id,
        selectedId: null,
        editor: {
          ...state.editor,
          mode: 'static',
          activeAnimationId: null,
          activeFrameId: null,
          selectedWidgetId: null,
          playing: false,
        },
      };
    }

    case 'DELETE_SCREEN': {
      if (state.screens.length <= 1) return state;
      const committed = commitActive(state);
      const remaining = committed.filter((s) => s.id !== action.payload);
      const wasActive = state.activeScreenId === action.payload;
      const nextActive = wasActive ? remaining[0] : remaining.find((s) => s.id === state.activeScreenId)!;
      const defaultScreenId = state.project.defaultScreenId === action.payload
        ? remaining[0].id : state.project.defaultScreenId;
      return {
        ...state,
        screens: remaining,
        project: { ...state.project, defaultScreenId },
        activeScreenId: nextActive.id,
        layers: nextActive.layers,
        animations: nextActive.animations,
        widgets: nextActive.widgets,
        erasedPixels: nextActive.erasedPixels,
        selectedLayerId: nextActive.layers[0]?.id ?? '',
        selectedId: null,
        editor: {
          ...state.editor,
          mode: 'static',
          activeAnimationId: nextActive.animations[0]?.id ?? null,
          activeFrameId: nextActive.animations[0]?.frames[0]?.id ?? null,
          selectedWidgetId: null,
          playing: false,
        },
      };
    }

    case 'RENAME_SCREEN': {
      const committed = commitActive(state);
      return { ...state, screens: committed.map((s) => s.id === action.payload.id ? { ...s, name: action.payload.name } : s) };
    }

    case 'DUPLICATE_SCREEN': {
      const committed = commitActive(state);
      const src = committed.find((s) => s.id === action.payload);
      if (!src) return state;
      const copy = cloneScreen(src, `${src.name} copy`);
      const idx = committed.findIndex((s) => s.id === src.id);
      const newScreens = [...committed.slice(0, idx + 1), copy, ...committed.slice(idx + 1)];
      return {
        ...state,
        screens: newScreens,
        activeScreenId: copy.id,
        layers: copy.layers,
        animations: copy.animations,
        widgets: copy.widgets,
        erasedPixels: copy.erasedPixels,
        selectedLayerId: copy.layers[0].id,
        selectedId: null,
        editor: {
          ...state.editor,
          mode: 'static',
          activeAnimationId: copy.animations[0]?.id ?? null,
          activeFrameId: copy.animations[0]?.frames[0]?.id ?? null,
          selectedWidgetId: null,
          playing: false,
        },
      };
    }

    case 'REORDER_SCREEN': {
      const committed = commitActive(state);
      const idx = committed.findIndex((s) => s.id === action.payload.id);
      if (idx === -1) return state;
      const swap = action.payload.direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= committed.length) return state;
      const next = [...committed];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...state, screens: next };
    }

    case 'SELECT_SCREEN': {
      if (action.payload === state.activeScreenId) return state;
      const committed = commitActive(state);
      const target = committed.find((s) => s.id === action.payload);
      if (!target) return state;
      return {
        ...state,
        screens: committed,
        activeScreenId: target.id,
        layers: target.layers,
        animations: target.animations,
        widgets: target.widgets,
        erasedPixels: target.erasedPixels,
        selectedLayerId: target.layers[0]?.id ?? '',
        selectedId: null,
        selectedIds: [],
        editor: {
          ...state.editor,
          mode: 'static',
          activeAnimationId: target.animations[0]?.id ?? null,
          activeFrameId: target.animations[0]?.frames[0]?.id ?? null,
          selectedWidgetId: null,
          playing: false,
        },
      };
    }

    case 'SET_DEFAULT_SCREEN':
      return { ...state, project: { ...state.project, defaultScreenId: action.payload } };

    case 'SET_PROJECT_NAME':
      return { ...state, project: { ...state.project, name: action.payload } };

    case 'SET_SCREEN_TRANSITION': {
      const committed = commitActive(state);
      return { ...state, screens: committed.map((s) => s.id === action.payload.id ? { ...s, transition: action.payload.transition } : s) };
    }

    case 'LOAD_PROJECT': {
      const p = action.payload;
      let screens: Screen[];
      if (p.screens && p.screens.length > 0) {
        screens = p.screens.map((s) => ({
          ...s,
          transition: s.transition ?? 'instant',
          layers: s.layers && s.layers.length > 0 ? s.layers : [makeLayer('main')],
          animations: s.animations ?? [],
          widgets: s.widgets ?? [],
          erasedPixels: s.erasedPixels ?? [],
        }));
      } else {
        let legacyLayers: Layer[];
        if (p.layers && p.layers.length > 0) legacyLayers = p.layers;
        else if (p.elements) legacyLayers = [makeLayer('main', p.elements)];
        else legacyLayers = [makeLayer('main')];
        screens = [{
          id: uid('screen'),
          name: 'Screen 1',
          transition: 'instant',
          layers: legacyLayers,
          animations: p.animations ?? [],
          widgets: p.widgets ?? [],
          erasedPixels: p.erasedPixels ?? [],
        }];
      }
      const projectMeta: ProjectMeta = {
        name: p.project?.name ?? 'My Gadget',
        defaultScreenId: screens.find((s) => s.id === p.project?.defaultScreenId)?.id ?? screens[0].id,
      };
      const active = screens.find((s) => s.id === projectMeta.defaultScreenId) ?? screens[0];
      return {
        ...state,
        display: p.display,
        project: projectMeta,
        screens,
        activeScreenId: active.id,
        layers: active.layers,
        animations: active.animations,
        widgets: active.widgets,
        erasedPixels: active.erasedPixels,
        selectedLayerId: active.layers[0].id,
        selectedId: null,
        selectedIds: [],
        editor: {
          ...state.editor,
          activeAnimationId: active.animations[0]?.id ?? null,
          activeFrameId: active.animations[0]?.frames[0]?.id ?? null,
          selectedWidgetId: null,
          playing: false,
        },
      };
    }

    default:
      return state;
  }
}
