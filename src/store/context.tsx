import {
  createContext, useContext, useReducer, useEffect, useRef, useMemo,
  type ReactNode, type Dispatch,
} from 'react';
import type { AppState, Action } from './types';
import { initialState } from './initialState';
import { historyReducer, initHistory, type HistoryMeta } from './history';
import {
  AUTOSAVE_DEBOUNCE_MS, newSessionId, readAutosave, writeAutosave,
  upsertRecent, type AutosaveEnvelope,
} from '../persistence';

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  /** Stable id used for the autosave slot and matching recent entry. */
  sessionId: string;
  /** Force a fresh session id (after opening/loading a different project). */
  resetSession: (id?: string) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // On mount, try to restore the last autosaved working session.
  const bootstrap = useMemo<{ meta: HistoryMeta; sessionId: string }>(() => {
    const restored = tryRestoreAutosave();
    if (restored) {
      return { meta: initHistory(restored.state), sessionId: restored.sessionId };
    }
    return { meta: initHistory(initialState), sessionId: newSessionId() };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [meta, dispatch] = useReducer(
    (m: HistoryMeta, a: Action) => historyReducer(m, a),
    bootstrap.meta,
  );
  const sessionIdRef = useRef(bootstrap.sessionId);

  const resetSession = (id?: string) => {
    const next = id ?? newSessionId();
    sessionIdRef.current = next;
    return next;
  };

  // Debounced autosave. Skip the very first effect run when nothing has
  // changed yet so we don't overwrite an existing slot on a clean boot.
  const firstAutosaveRef = useRef(true);
  useEffect(() => {
    if (firstAutosaveRef.current) {
      firstAutosaveRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const envelope: AutosaveEnvelope = {
        id: sessionIdRef.current,
        name: meta.present.project.name || 'Untitled',
        savedAt: Date.now(),
        data: {
          display: meta.present.display,
          project: meta.present.project,
          screens: commitForSerialize(meta.present),
        },
      };
      writeAutosave(envelope);
      // Mirror into recents so the session is reachable later.
      // Stored under the same id so we update an entry instead of
      // cloning every keystroke into a new one.
      upsertRecent(envelope);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [meta.present]);

  // Flush a synchronous autosave on tab close so we never lose the last edit.
  useEffect(() => {
    const flush = () => {
      writeAutosave({
        id: sessionIdRef.current,
        name: meta.present.project.name || 'Untitled',
        savedAt: Date.now(),
        data: {
          display: meta.present.display,
          project: meta.present.project,
          screens: commitForSerialize(meta.present),
        },
      });
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [meta.present]);

  const value = useMemo<StoreValue>(() => ({
    state: meta.present,
    dispatch,
    canUndo: meta.past.length > 0,
    canRedo: meta.future.length > 0,
    sessionId: sessionIdRef.current,
    resetSession,
  }), [meta.present, meta.past.length, meta.future.length]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// Lightweight commit to avoid pulling the helpers module into this
// hot path. Mirrors the snapshot done by `commitActive`.
function commitForSerialize(s: AppState) {
  return s.screens.map((scr) => (
    scr.id === s.activeScreenId
      ? { ...scr, layers: s.layers, animations: s.animations, widgets: s.widgets, erasedPixels: s.erasedPixels }
      : scr
  ));
}

/**
 * Attempt to restore the last autosaved working session into an AppState.
 * Returns null if no autosave exists or it's malformed.
 */
function tryRestoreAutosave(): { state: AppState; sessionId: string } | null {
  const env = readAutosave();
  if (!env || !env.data || !Array.isArray(env.data.screens) || env.data.screens.length === 0) {
    return null;
  }
  try {
    // Rehydrate bitmap data (stored as number[] after JSON round-trip).
    const screens = env.data.screens.map((s) => ({
      ...s,
      layers: (s.layers || []).map((l) => ({
        ...l,
        elements: (l.elements || []).map((el) => restoreBitmap(el)),
      })),
      animations: (s.animations || []).map((a) => ({
        ...a,
        frames: (a.frames || []).map((f) => ({
          ...f,
          elements: (f.elements || []).map((el) => restoreBitmap(el)),
        })),
      })),
      widgets: s.widgets || [],
      erasedPixels: s.erasedPixels || [],
      transition: s.transition || 'instant',
    }));
    const active = screens[0];
    const state: AppState = {
      ...initialState,
      display: env.data.display,
      project: env.data.project,
      screens,
      activeScreenId: active.id,
      layers: active.layers,
      animations: active.animations,
      widgets: active.widgets,
      erasedPixels: active.erasedPixels,
      selectedLayerId: active.layers[0]?.id ?? '',
      selectedId: null,
      selectedIds: [],
      editor: {
        ...initialState.editor,
        activeAnimationId: active.animations[0]?.id ?? null,
        activeFrameId: active.animations[0]?.frames[0]?.id ?? null,
      },
    };
    return { state, sessionId: env.id || newSessionId() };
  } catch {
    return null;
  }
}

function restoreBitmap<T extends { type?: string; data?: unknown }>(el: T): T {
  if (el && el.type === 'bitmap' && Array.isArray(el.data)) {
    return { ...el, data: new Uint8Array(el.data as number[]) } as T;
  }
  return el;
}
