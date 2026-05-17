import type { AppState, Action } from '../types';
import { findElement } from '../helpers';
import { uid } from '../../utils/uid';

export function reduceLayer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_LAYER': {
      const baseName = action.payload?.name?.trim() || `layer ${state.layers.length + 1}`;
      const layer = { id: uid('layer'), name: baseName, visible: true, elements: [] as import('../../types').CanvasElement[] };
      return { ...state, layers: [...state.layers, layer], selectedLayerId: layer.id };
    }

    case 'DELETE_LAYER': {
      if (state.layers.length <= 1) return state;
      const newLayers = state.layers.filter((l) => l.id !== action.payload);
      const selectedLayerId =
        state.selectedLayerId === action.payload ? newLayers[0].id : state.selectedLayerId;
      const stillHasSelected =
        state.selectedId && newLayers.some((l) => l.elements.some((e) => e.id === state.selectedId));
      return { ...state, layers: newLayers, selectedLayerId, selectedId: stillHasSelected ? state.selectedId : null };
    }

    case 'RENAME_LAYER':
      return { ...state, layers: state.layers.map((l) => l.id === action.payload.id ? { ...l, name: action.payload.name } : l) };

    case 'TOGGLE_LAYER_VISIBLE':
      return { ...state, layers: state.layers.map((l) => l.id === action.payload ? { ...l, visible: !l.visible } : l) };

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
      const found = findElement(state, action.payload.elementId);
      if (!found || found.kind !== 'layer' || found.layer.id === action.payload.layerId) return state;
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
