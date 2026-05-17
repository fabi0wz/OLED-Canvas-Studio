import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  readRecents, removeRecent, clearAutosave, upsertRecent,
  serializeState, projectToJSON, rehydrateProject, newSessionId,
  formatRelative, type RecentEntry,
} from '../persistence';

/**
 * File menu: New, Open, Save, Recents, Undo, Redo.
 *
 * Save/Open also exist on the CodePanel (legacy) — those still work.
 * This menu is the discoverable entry point and adds the browser-side
 * failsafe features (autosave / recents / undo).
 */
export default function FileMenu() {
  const { state, dispatch, canUndo, canRedo, sessionId, resetSession } = useStore();
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Refresh recents whenever the menu opens.
  useEffect(() => {
    if (open) setRecents(readRecents());
  }, [open]);

  function snapshotCurrentToRecents() {
    // Make sure the current session is in recents before discarding it,
    // so "Recent Projects" can take the user back.
    if (!state.layers.length && !state.animations.length && !state.widgets.length) return;
    upsertRecent({
      id: sessionId,
      name: state.project.name || 'Untitled',
      savedAt: Date.now(),
      data: serializeState(state),
    });
  }

  function loadEntry(entry: RecentEntry) {
    const proj = rehydrateProject(JSON.parse(JSON.stringify(entry.data)));
    if (!proj) { alert('That project could not be opened.'); return; }
    snapshotCurrentToRecents();
    resetSession(entry.id);
    dispatch({ type: 'LOAD_PROJECT', payload: proj });
    setOpen(false);
  }

  function handleNew() {
    const dirty = (
      state.layers.some((l) => l.elements.length > 0) ||
      state.animations.length > 0 ||
      state.widgets.length > 0 ||
      state.screens.length > 1
    );
    if (dirty) {
      const choice = window.confirm(
        'Start a new project? Your current work is autosaved in "Recent Projects" — click OK to continue, or Cancel to keep editing.'
      );
      if (!choice) return;
      snapshotCurrentToRecents();
    }
    clearAutosave();
    resetSession();
    // Build a clean empty project payload and dispatch as LOAD_PROJECT so
    // the screen reducer rebuilds everything (including a fresh default screen).
    dispatch({
      type: 'LOAD_PROJECT',
      payload: {
        display: state.display, // keep the user's current display config
        project: { name: 'My Gadget', defaultScreenId: '' },
        screens: [],
      },
    });
    setOpen(false);
  }

  function handleOpenFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          const proj = rehydrateProject(parsed);
          if (!proj) { alert('Invalid project file.'); return; }
          snapshotCurrentToRecents();
          resetSession();
          dispatch({ type: 'LOAD_PROJECT', payload: proj });
        } catch {
          alert('Invalid project file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setOpen(false);
  }

  function handleSaveFile() {
    const json = projectToJSON(serializeState(state));
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.project.name || 'oled_project').replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function handleForgetRecent(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setRecents(removeRecent(id));
  }

  return (
    <div className="file-menu-wrap" ref={wrapRef}>
      <button
        className={`tool-btn file-menu-btn ${open ? 'tool-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="File menu"
      >
        <span className="tool-icon" dangerouslySetInnerHTML={{ __html:
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>`
        }} />
        <span className="tool-key">FILE</span>
      </button>

      {open && (
        <div className="file-menu" role="menu">
          <button className="file-menu-item" onClick={handleNew}>
            <span className="fmi-label">New project</span>
            <span className="fmi-shortcut">⌘N</span>
          </button>
          <button className="file-menu-item" onClick={handleOpenFile}>
            <span className="fmi-label">Open file…</span>
            <span className="fmi-shortcut">⌘O</span>
          </button>
          <button className="file-menu-item" onClick={handleSaveFile}>
            <span className="fmi-label">Save to file…</span>
            <span className="fmi-shortcut">⌘S</span>
          </button>

          <div className="file-menu-divider" />

          <button
            className="file-menu-item"
            onClick={() => { dispatch({ type: 'UNDO' }); setOpen(false); }}
            disabled={!canUndo}
          >
            <span className="fmi-label">Undo</span>
            <span className="fmi-shortcut">⌘Z</span>
          </button>
          <button
            className="file-menu-item"
            onClick={() => { dispatch({ type: 'REDO' }); setOpen(false); }}
            disabled={!canRedo}
          >
            <span className="fmi-label">Redo</span>
            <span className="fmi-shortcut">⇧⌘Z</span>
          </button>

          <div className="file-menu-divider" />

          <div className="file-menu-heading">Recent projects</div>
          {recents.length === 0 && (
            <div className="file-menu-empty">No recent projects yet.</div>
          )}
          {recents.map((r) => {
            const isCurrent = r.id === sessionId;
            return (
              <button
                key={r.id}
                className={`file-menu-item recent-item ${isCurrent ? 'recent-current' : ''}`}
                onClick={() => loadEntry(r)}
                title={isCurrent ? 'Currently open' : `Open "${r.name}"`}
              >
                <span className="fmi-label recent-name">
                  {r.name}
                  {isCurrent && <span className="recent-badge"> · current</span>}
                </span>
                <span className="fmi-shortcut recent-time">{formatRelative(r.savedAt)}</span>
                <span
                  className="recent-forget"
                  role="button"
                  title="Remove from recents"
                  onClick={(e) => handleForgetRecent(e, r.id)}
                >×</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Re-export the session id generator for callers that want to create
   matching ids manually. */
export { newSessionId };
