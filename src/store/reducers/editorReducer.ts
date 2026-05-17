import type { AppState, Action } from '../types';
import { DISPLAY_PRESETS } from '../../types';

export function reduceEditor(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_DISPLAY': {
      const preset = DISPLAY_PRESETS.find((p) => p.type === action.payload.type) ?? action.payload;
      return { ...state, display: preset };
    }

    case 'SET_SCENE_MODE':
      return { ...state, editor: { ...state.editor, mode: action.payload } };

    case 'SET_ONION':
      return { ...state, editor: { ...state.editor, ...action.payload } };

    case 'SET_PLAYING':
      return { ...state, editor: { ...state.editor, playing: action.payload } };

    case 'SET_ADD_TARGET':
      return { ...state, editor: { ...state.editor, addTarget: action.payload } };

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };

    case 'SET_SNAP':
      return { ...state, snapSize: action.payload };

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };

    default:
      return state;
  }
}
