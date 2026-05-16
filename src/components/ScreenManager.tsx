import { useState } from 'react';
import { useStore } from '../store';
import { SCREEN_TRANSITIONS, type ScreenTransition } from '../types';

/**
 * Top-level project screen tab bar. Lets users add/select/rename/duplicate/
 * delete/reorder screens and pick the default boot screen.
 */
export default function ScreenManager() {
  const { state, dispatch } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = state.screens.find((s) => s.id === state.activeScreenId);

  return (
    <div className="screen-manager">
      <div className="screen-tabs" role="tablist">
        {state.screens.map((s, idx) => {
          const isActive = s.id === state.activeScreenId;
          const isDefault = s.id === state.project.defaultScreenId;
          return (
            <div
              key={s.id}
              role="tab"
              aria-selected={isActive}
              className={`screen-tab ${isActive ? 'screen-active' : ''}`}
              onClick={() => dispatch({ type: 'SELECT_SCREEN', payload: s.id })}
              onDoubleClick={() => setEditingId(s.id)}
              title={`Screen ${idx + 1}${isDefault ? ' (default)' : ''} — double-click to rename`}
            >
              <span className="screen-idx">{idx + 1}</span>
              {editingId === s.id ? (
                <input
                  autoFocus
                  className="screen-name-input"
                  defaultValue={s.name}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim() || s.name;
                    dispatch({ type: 'RENAME_SCREEN', payload: { id: s.id, name } });
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="screen-name">{s.name}</span>
              )}
              {isDefault && <span className="screen-default-badge" title="Default boot screen">★</span>}
            </div>
          );
        })}
        <button
          className="screen-add-btn"
          onClick={() => dispatch({ type: 'ADD_SCREEN' })}
          title="Add screen"
        >+ Screen</button>
      </div>

      {active && (
        <div className="screen-actions">
          <button
            onClick={() => dispatch({ type: 'DUPLICATE_SCREEN', payload: active.id })}
            title="Duplicate this screen"
          >Duplicate</button>
          <button
            onClick={() => {
              const idx = state.screens.findIndex((s) => s.id === active.id);
              if (idx > 0) dispatch({ type: 'REORDER_SCREEN', payload: { id: active.id, direction: 'up' } });
            }}
            title="Move screen left"
            disabled={state.screens[0]?.id === active.id}
          >◀</button>
          <button
            onClick={() => {
              const idx = state.screens.findIndex((s) => s.id === active.id);
              if (idx < state.screens.length - 1) dispatch({ type: 'REORDER_SCREEN', payload: { id: active.id, direction: 'down' } });
            }}
            title="Move screen right"
            disabled={state.screens[state.screens.length - 1]?.id === active.id}
          >▶</button>
          <label className="screen-transition-label" title="Transition into this screen">
            <span>Trans</span>
            <select
              value={active.transition}
              onChange={(e) => dispatch({
                type: 'SET_SCREEN_TRANSITION',
                payload: { id: active.id, transition: e.target.value as ScreenTransition },
              })}
            >
              {SCREEN_TRANSITIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            className={state.project.defaultScreenId === active.id ? 'btn-active' : ''}
            onClick={() => dispatch({ type: 'SET_DEFAULT_SCREEN', payload: active.id })}
            title="Set as default boot screen"
          >★ Default</button>
          <button
            onClick={() => {
              if (state.screens.length <= 1) {
                alert('A project must keep at least one screen.');
                return;
              }
              if (confirm(`Delete screen "${active.name}"? This cannot be undone.`)) {
                dispatch({ type: 'DELETE_SCREEN', payload: active.id });
              }
            }}
            disabled={state.screens.length <= 1}
            title="Delete this screen"
          >✕</button>
        </div>
      )}
    </div>
  );
}
