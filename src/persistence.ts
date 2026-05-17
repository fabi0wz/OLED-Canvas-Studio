/**
 * Browser-side project persistence.
 *
 * - Autosave: a single localStorage slot that mirrors the current working
 *   project. Updated by a debounced effect so a page refresh or crash
 *   doesn't wipe out hours of work.
 * - Recents: a small ring of recent projects (up to RECENTS_LIMIT,
 *   pruned after RECENTS_TTL_MS) so a user can re-open whatever they
 *   were working on a few days later.
 *
 * Storage format mirrors the file Save/Load in CodePanel: bitmap
 * `Uint8Array` data is serialized as a plain number array and rehydrated
 * on read.
 */

import type { AppState } from './store';
import type { Project } from './types';
import { commitActive } from './store/helpers';

const AUTOSAVE_KEY = 'oled-canvas-studio:autosave/v1';
const RECENTS_KEY = 'oled-canvas-studio:recents/v1';

export const RECENTS_LIMIT = 8;
export const RECENTS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const AUTOSAVE_DEBOUNCE_MS = 1500;

export interface SerializedProject {
  display: Project['display'];
  project: NonNullable<Project['project']>;
  screens: NonNullable<Project['screens']>;
}

export interface AutosaveEnvelope {
  /** Stable id for this working session so the same slot is updated. */
  id: string;
  /** Display name (project.name). */
  name: string;
  /** Last update timestamp (ms since epoch). */
  savedAt: number;
  /** The serialized project payload. */
  data: SerializedProject;
}

export interface RecentEntry {
  id: string;
  name: string;
  savedAt: number;
  data: SerializedProject;
}

/* ------------------------------------------------------------------ */
/*  Serialize / deserialize                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a Project-shaped payload from live state, committing the
 * currently active screen first so its in-flight edits are included.
 */
export function serializeState(state: AppState): SerializedProject {
  return {
    display: state.display,
    project: state.project,
    screens: commitActive(state),
  };
}

/** Convert a SerializedProject to a JSON string with Uint8Array → number[]. */
export function projectToJSON(p: SerializedProject): string {
  return JSON.stringify(p, (_key, value) => {
    if (value instanceof Uint8Array) return Array.from(value);
    return value;
  });
}

/**
 * Rehydrate bitmap data after a JSON round-trip. Walks layers and
 * animation frames of every screen, restoring `Uint8Array` for bitmap
 * element `data`.
 */
export function rehydrateProject(data: unknown): Project | null {
  if (!data || typeof data !== 'object') return null;
  const p = data as Project;
  if (!p.display) return null;
  if (!p.screens && !p.layers && !p.elements) return null;

  const restore = (containers: { elements?: { type?: string; data?: unknown }[] }[] | undefined) => {
    for (const c of containers || []) {
      for (const el of c.elements || []) {
        if (el.type === 'bitmap' && Array.isArray(el.data)) {
          (el as { data: Uint8Array }).data = new Uint8Array(el.data as number[]);
        }
      }
    }
  };

  if (Array.isArray(p.screens)) {
    for (const s of p.screens) {
      restore(s.layers);
      for (const a of s.animations || []) restore(a.frames);
    }
  } else {
    restore(p.layers);
    for (const a of p.animations || []) restore(a.frames);
  }
  return p;
}

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    // Quota / disabled storage — silently ignore so editing keeps working.
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Autosave                                                           */
/* ------------------------------------------------------------------ */

export function writeAutosave(envelope: AutosaveEnvelope): boolean {
  // Pre-serialize so the Uint8Array replacer runs once.
  const payload = JSON.stringify({
    id: envelope.id,
    name: envelope.name,
    savedAt: envelope.savedAt,
    data: envelope.data,
  }, (_key, value) => (value instanceof Uint8Array ? Array.from(value) : value));
  return safeWrite(AUTOSAVE_KEY, payload);
}

export function readAutosave(): AutosaveEnvelope | null {
  const env = safeRead<AutosaveEnvelope>(AUTOSAVE_KEY);
  if (!env || !env.data) return null;
  const project = rehydrateProject(env.data);
  if (!project) return null;
  return { ...env, data: env.data };
}

export function clearAutosave(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Recents                                                            */
/* ------------------------------------------------------------------ */

export function readRecents(): RecentEntry[] {
  const list = safeRead<RecentEntry[]>(RECENTS_KEY) ?? [];
  const cutoff = Date.now() - RECENTS_TTL_MS;
  return list.filter((r) => r && r.savedAt >= cutoff && r.data);
}

export function writeRecents(list: RecentEntry[]): boolean {
  const trimmed = list
    .slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, RECENTS_LIMIT);
  // Use JSON.stringify with replacer so any Uint8Arrays that snuck in are converted.
  const payload = JSON.stringify(trimmed, (_key, value) =>
    value instanceof Uint8Array ? Array.from(value) : value
  );
  return safeWrite(RECENTS_KEY, payload);
}

/**
 * Insert/update an entry in recents keyed by `id`. Returns the updated list.
 */
export function upsertRecent(entry: RecentEntry): RecentEntry[] {
  const cur = readRecents().filter((r) => r.id !== entry.id);
  cur.unshift(entry);
  writeRecents(cur);
  return cur;
}

export function removeRecent(id: string): RecentEntry[] {
  const next = readRecents().filter((r) => r.id !== id);
  writeRecents(next);
  return next;
}

export function clearRecents(): void {
  try { localStorage.removeItem(RECENTS_KEY); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Misc                                                               */
/* ------------------------------------------------------------------ */

/** Generate a new session id used as the autosave / recent key. */
export function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Pretty relative timestamp ("5m ago", "2h ago", "3d ago"). */
export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
