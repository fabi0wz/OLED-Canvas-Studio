import type { AppState, Action } from '../types';
import { reduceElement } from './elementReducer';
import { reduceLayer } from './layerReducer';
import { reduceAnimation } from './animationReducer';
import { reduceWidget } from './widgetReducer';
import { reduceScreen } from './screenReducer';
import { reduceEditor } from './editorReducer';

const ELEMENT_ACTIONS = new Set([
  'ADD_ELEMENT', 'UPDATE_ELEMENT', 'DELETE_ELEMENT', 'SELECT_ELEMENT',
  'MOVE_ELEMENT', 'REORDER_ELEMENT', 'DUPLICATE_ELEMENT', 'SET_TOOL',
  'ADD_PIXELS', 'ERASE_PIXEL', 'CLEAR_ERASED', 'TRANSFORM_ELEMENT', 'RESIZE_ELEMENT',
  'SELECT_ELEMENT_MULTI', 'SELECT_ELEMENTS', 'GROUP_ELEMENTS', 'UNGROUP_ELEMENT', 'FLATTEN_ELEMENTS',
]);

const LAYER_ACTIONS = new Set([
  'ADD_LAYER', 'DELETE_LAYER', 'RENAME_LAYER', 'TOGGLE_LAYER_VISIBLE',
  'SELECT_LAYER', 'REORDER_LAYER', 'MOVE_ELEMENT_TO_LAYER',
]);

const ANIMATION_ACTIONS = new Set([
  'ADD_ANIMATION', 'DELETE_ANIMATION', 'RENAME_ANIMATION', 'TOGGLE_ANIMATION_VISIBLE',
  'SELECT_ANIMATION', 'UPDATE_ANIMATION', 'ADD_FRAME', 'DUPLICATE_FRAME',
  'DELETE_FRAME', 'REORDER_FRAME', 'SELECT_FRAME', 'UPDATE_FRAME',
]);

const WIDGET_ACTIONS = new Set([
  'ADD_WIDGET', 'UPDATE_WIDGET', 'DELETE_WIDGET', 'SELECT_WIDGET', 'MOVE_WIDGET',
]);

const SCREEN_ACTIONS = new Set([
  'ADD_SCREEN', 'DELETE_SCREEN', 'RENAME_SCREEN', 'DUPLICATE_SCREEN',
  'REORDER_SCREEN', 'SELECT_SCREEN', 'SET_DEFAULT_SCREEN', 'SET_SCREEN_TRANSITION',
  'LOAD_PROJECT', 'SET_PROJECT_NAME',
]);

const EDITOR_ACTIONS = new Set([
  'SET_DISPLAY', 'SET_SCENE_MODE', 'SET_ONION', 'SET_PLAYING',
  'TOGGLE_GRID', 'SET_SNAP', 'SET_ZOOM',
]);

export function rootReducer(state: AppState, action: Action): AppState {
  const t = action.type;
  if (ELEMENT_ACTIONS.has(t)) return reduceElement(state, action);
  if (LAYER_ACTIONS.has(t)) return reduceLayer(state, action);
  if (ANIMATION_ACTIONS.has(t)) return reduceAnimation(state, action);
  if (WIDGET_ACTIONS.has(t)) return reduceWidget(state, action);
  if (SCREEN_ACTIONS.has(t)) return reduceScreen(state, action);
  if (EDITOR_ACTIONS.has(t)) return reduceEditor(state, action);
  return state;
}
