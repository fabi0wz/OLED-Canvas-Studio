/**
 * Undo/redo history wrapper around the root reducer.
 *
 * - Keeps the last `HISTORY_LIMIT` undoable steps.
 * - Coalesces consecutive same-target actions (e.g. live drag updates,
 *   typing in a text field) into a single undo step using a short
 *   debounce window so the user gets meaningful steps, not one per
 *   pixel of mouse movement.
 * - Skips purely transient/UI actions (selection, tool, zoom) entirely
 *   so they neither create steps nor clear the redo stack.
 */

import type { AppState, Action } from './types';
import { rootReducer } from './reducers';

export const HISTORY_LIMIT = 15;
const COALESCE_MS = 800;

/** Actions that change UI-only state and shouldn't participate in history. */
const NON_UNDOABLE = new Set<Action['type']>([
  'SET_TOOL', 'SET_ZOOM', 'TOGGLE_GRID', 'SET_SNAP',
  'SET_SCENE_MODE', 'SET_ONION', 'SET_PLAYING', 'SET_ADD_TARGET',
  'SELECT_ELEMENT', 'SELECT_ELEMENT_MULTI', 'SELECT_ELEMENTS',
  'SELECT_LAYER', 'SELECT_ANIMATION', 'SELECT_FRAME',
  'SELECT_WIDGET', 'SELECT_SCREEN', 'CLEAR_ERASED',
]);

/** Meta actions handled by the wrapper itself; rootReducer ignores them. */
export type HistoryAction =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET_HISTORY' };

export interface HistoryMeta {
  past: AppState[];
  present: AppState;
  future: AppState[];
  /** Key of the last coalesce-eligible action; used to merge runs of edits. */
  lastKey: string | null;
  /** Timestamp of the last push (ms since epoch). */
  lastTime: number;
}

/**
 * Returns a string key for actions that should coalesce into a single
 * history step when fired rapidly in succession (e.g. the same element
 * being dragged). Returns null when the action should always create a
 * fresh history step.
 */
function coalesceKey(action: Action): string | null {
  switch (action.type) {
    case 'UPDATE_ELEMENT':   return `UPDATE_ELEMENT:${action.payload.id}`;
    case 'MOVE_ELEMENT':     return `MOVE_ELEMENT:${action.payload.id}`;
    case 'RESIZE_ELEMENT':   return `RESIZE_ELEMENT:${action.payload.id}`;
    case 'ADD_PIXELS':       return `ADD_PIXELS:${action.payload.id}`;
    case 'ERASE_PIXEL':      return 'ERASE_PIXEL';
    case 'MOVE_WIDGET':      return `MOVE_WIDGET:${action.payload.id}`;
    case 'UPDATE_WIDGET':    return `UPDATE_WIDGET:${action.payload.id}`;
    case 'UPDATE_ANIMATION': return `UPDATE_ANIMATION:${action.payload.id}`;
    case 'UPDATE_FRAME':     return `UPDATE_FRAME:${action.payload.animationId}:${action.payload.frameId}`;
    case 'SET_PROJECT_NAME': return 'SET_PROJECT_NAME';
    case 'RENAME_LAYER':     return `RENAME_LAYER:${action.payload.id}`;
    case 'RENAME_SCREEN':    return `RENAME_SCREEN:${action.payload.id}`;
    case 'RENAME_ANIMATION': return `RENAME_ANIMATION:${action.payload.id}`;
    default: return null;
  }
}

export function initHistory(present: AppState): HistoryMeta {
  return { past: [], present, future: [], lastKey: null, lastTime: 0 };
}

/**
 * Meta reducer wrapping `rootReducer` to maintain undo history.
 * Pass an optional `now` for deterministic testing; defaults to Date.now().
 */
export function historyReducer(
  meta: HistoryMeta,
  action: Action | HistoryAction,
  now: number = Date.now(),
): HistoryMeta {
  // ----- History controls -----------------------------------------
  if (action.type === 'UNDO') {
    if (meta.past.length === 0) return meta;
    const prev = meta.past[meta.past.length - 1];
    return {
      past: meta.past.slice(0, -1),
      present: prev,
      future: [meta.present, ...meta.future].slice(0, HISTORY_LIMIT),
      lastKey: null,
      lastTime: 0,
    };
  }
  if (action.type === 'REDO') {
    if (meta.future.length === 0) return meta;
    const next = meta.future[0];
    return {
      past: [...meta.past, meta.present].slice(-HISTORY_LIMIT),
      present: next,
      future: meta.future.slice(1),
      lastKey: null,
      lastTime: 0,
    };
  }
  if (action.type === 'RESET_HISTORY') {
    return { past: [], present: meta.present, future: [], lastKey: null, lastTime: 0 };
  }

  // ----- Delegate to root reducer ---------------------------------
  const nextPresent = rootReducer(meta.present, action as Action);
  if (nextPresent === meta.present) return meta;

  // Loading a project replaces everything; clear history.
  if (action.type === 'LOAD_PROJECT') {
    return { past: [], present: nextPresent, future: [], lastKey: null, lastTime: 0 };
  }

  // UI-only actions: advance present, don't touch past/future.
  if (NON_UNDOABLE.has(action.type)) {
    return { ...meta, present: nextPresent };
  }

  const key = coalesceKey(action);
  if (key && key === meta.lastKey && (now - meta.lastTime) < COALESCE_MS) {
    // Same run of edits — keep the existing entry on `past` (which holds
    // the state from *before* this run started) and just advance present.
    return { ...meta, present: nextPresent, lastTime: now };
  }

  const past = [...meta.past, meta.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);

  return {
    past,
    present: nextPresent,
    future: [], // any new edit invalidates the redo stack
    lastKey: key,
    lastTime: now,
  };
}
