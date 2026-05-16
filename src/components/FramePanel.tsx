import { useStore } from '../store';
import type { FrameAnimation, AnimationPlayMode } from '../types';

/**
 * Frame-by-frame animation editor: list of animations, frame strip of the
 * currently selected animation, and per-frame controls.
 */
export default function FramePanel() {
  const { state, dispatch } = useStore();
  const anim: FrameAnimation | undefined = state.animations.find((a) => a.id === state.editor.activeAnimationId);
  const activeFrameId = state.editor.activeFrameId;

  return (
    <div className="panel frame-panel">
      <h3>Animations</h3>

      <div className="layer-controls">
        <button onClick={() => dispatch({ type: 'ADD_ANIMATION' })} title="Add animation">+ Animation</button>
      </div>

      <ul className="layer-list">
        {state.animations.map((a) => {
          const isActive = a.id === state.editor.activeAnimationId;
          return (
            <li key={a.id} className={`layer-item ${isActive ? 'active' : ''}`}>
              <div className="layer-row" onClick={() => dispatch({ type: 'SELECT_ANIMATION', payload: a.id })}>
                <button
                  className={`layer-eye ${a.visible ? 'on' : 'off'}`}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_ANIMATION_VISIBLE', payload: a.id }); }}
                  title={a.visible ? 'Hide' : 'Show'}
                >{a.visible ? '●' : '○'}</button>
                <span className="layer-name">{a.name}</span>
                <span className="layer-count">{a.frames.length}f</span>
                <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-danger" title="Delete"
                    onClick={() => { if (confirm(`Delete animation "${a.name}"?`)) dispatch({ type: 'DELETE_ANIMATION', payload: a.id }); }}
                  >✕</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {anim && (
        <>
          <div className="prop-group" style={{ marginTop: 10 }}>
            <label>Name</label>
            <input
              type="text"
              value={anim.name}
              onChange={(e) => dispatch({ type: 'RENAME_ANIMATION', payload: { id: anim.id, name: e.target.value } })}
            />
          </div>
          <div className="prop-row">
            <div className="prop-group">
              <label>Offset X</label>
              <input
                type="number" value={anim.x}
                onChange={(e) => dispatch({ type: 'UPDATE_ANIMATION', payload: { id: anim.id, changes: { x: Number(e.target.value) } } })}
              />
            </div>
            <div className="prop-group">
              <label>Offset Y</label>
              <input
                type="number" value={anim.y}
                onChange={(e) => dispatch({ type: 'UPDATE_ANIMATION', payload: { id: anim.id, changes: { y: Number(e.target.value) } } })}
              />
            </div>
          </div>
          <div className="prop-group">
            <label>Play mode</label>
            <select
              value={anim.playMode}
              onChange={(e) => dispatch({ type: 'UPDATE_ANIMATION', payload: { id: anim.id, changes: { playMode: e.target.value as AnimationPlayMode } } })}
            >
              <option value="loop">loop</option>
              <option value="once">once</option>
              <option value="pingpong">ping-pong</option>
            </select>
          </div>

          <h3 style={{ marginTop: 14 }}>Frames</h3>
          <div className="frame-strip">
            {anim.frames.map((f, i) => (
              <div
                key={f.id}
                className={`frame-thumb ${f.id === activeFrameId ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SELECT_FRAME', payload: { animationId: anim.id, frameId: f.id } })}
                title={`Frame ${i + 1} · ${f.elements.length} el · ${f.durationMs}ms`}
              >
                <span className="frame-idx">{i + 1}</span>
                <span className="frame-count">{f.elements.length}</span>
                <span className="frame-dur">{f.durationMs}ms</span>
              </div>
            ))}
          </div>

          <div className="btn-group" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => dispatch({ type: 'ADD_FRAME', payload: { animationId: anim.id } })}>+ Frame</button>
            <button
              disabled={!activeFrameId}
              onClick={() => activeFrameId && dispatch({ type: 'DUPLICATE_FRAME', payload: { animationId: anim.id, frameId: activeFrameId } })}
            >Duplicate</button>
            <button
              disabled={!activeFrameId || anim.frames.length <= 1}
              onClick={() => activeFrameId && dispatch({ type: 'DELETE_FRAME', payload: { animationId: anim.id, frameId: activeFrameId } })}
              className="btn-danger"
            >Delete</button>
            <button
              disabled={!activeFrameId}
              onClick={() => activeFrameId && dispatch({ type: 'REORDER_FRAME', payload: { animationId: anim.id, frameId: activeFrameId, direction: 'left' } })}
            >←</button>
            <button
              disabled={!activeFrameId}
              onClick={() => activeFrameId && dispatch({ type: 'REORDER_FRAME', payload: { animationId: anim.id, frameId: activeFrameId, direction: 'right' } })}
            >→</button>
          </div>

          {/* Per-frame duration */}
          {activeFrameId && (() => {
            const f = anim.frames.find((x) => x.id === activeFrameId);
            if (!f) return null;
            return (
              <div className="prop-group" style={{ marginTop: 8 }}>
                <label>Frame duration (ms)</label>
                <input
                  type="number" min={16} step={16} value={f.durationMs}
                  onChange={(e) => dispatch({ type: 'UPDATE_FRAME', payload: { animationId: anim.id, frameId: f.id, changes: { durationMs: Math.max(16, Number(e.target.value)) } } })}
                />
              </div>
            );
          })()}

          {/* Onion-skin controls */}
          <h3 style={{ marginTop: 12 }}>Onion Skin</h3>
          <div className="prop-row">
            <label className="prop-group">
              <input
                type="checkbox" checked={state.editor.onionPrev}
                onChange={(e) => dispatch({ type: 'SET_ONION', payload: { onionPrev: e.target.checked } })}
              />
              <span>Prev</span>
            </label>
            <label className="prop-group">
              <input
                type="checkbox" checked={state.editor.onionNext}
                onChange={(e) => dispatch({ type: 'SET_ONION', payload: { onionNext: e.target.checked } })}
              />
              <span>Next</span>
            </label>
          </div>
          <div className="prop-group">
            <label>Opacity</label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={state.editor.onionOpacity}
              onChange={(e) => dispatch({ type: 'SET_ONION', payload: { onionOpacity: Number(e.target.value) } })}
            />
            <span className="prop-hint">{Math.round(state.editor.onionOpacity * 100)}%</span>
          </div>
        </>
      )}
      {!anim && <p className="muted" style={{ marginTop: 8 }}>No animation yet. Click “+ Animation” to create one.</p>}
    </div>
  );
}
