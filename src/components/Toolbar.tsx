import { useStore } from '../store';
import { DISPLAY_PRESETS, SNAP_PRESETS } from '../types';

const ZOOM_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

export default function Toolbar() {
  const { state, dispatch } = useStore();
  const zoomOptions = ZOOM_PRESETS.includes(state.zoom)
    ? ZOOM_PRESETS
    : [...ZOOM_PRESETS, state.zoom].sort((a, b) => a - b);

  return (
    <div className="panel toolbar">
      <h3>Workbench</h3>

      <div className="toolbar-section">
        <label>Display</label>
        <select
          value={state.display.type}
          onChange={(e) => {
            const preset = DISPLAY_PRESETS.find((p) => p.type === e.target.value);
            if (preset) dispatch({ type: 'SET_DISPLAY', payload: preset });
          }}
        >
          {DISPLAY_PRESETS.map((p) => (
            <option key={p.type} value={p.type}>{p.type} ({p.width}×{p.height})</option>
          ))}
        </select>
      </div>

      <div className="toolbar-section">
        <label>View</label>
        <div className="btn-group">
          <button
            className={state.showGrid ? 'btn-active' : ''}
            onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
          >
            Grid {state.showGrid ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <label>Snap</label>
        <select
          value={state.snapSize}
          onChange={(e) => dispatch({ type: 'SET_SNAP', payload: Number(e.target.value) })}
        >
          {SNAP_PRESETS.map((s) => (
            <option key={s} value={s}>{s === 0 ? 'Off' : `${s} px`}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-section">
        <label>Zoom</label>
        <div className="zoom-controls">
          <button onClick={() => {
            const idx = ZOOM_PRESETS.indexOf(state.zoom);
            const prev = idx > 0 ? ZOOM_PRESETS[idx - 1] : Math.max(1, state.zoom - 1);
            dispatch({ type: 'SET_ZOOM', payload: prev });
          }}>−</button>
          <select value={state.zoom} onChange={(e) => dispatch({ type: 'SET_ZOOM', payload: Number(e.target.value) })}>
            {zoomOptions.map((z) => (
              <option key={z} value={z}>{z}x</option>
            ))}
          </select>
          <button onClick={() => {
            const idx = ZOOM_PRESETS.indexOf(state.zoom);
            const next = idx >= 0 && idx < ZOOM_PRESETS.length - 1 ? ZOOM_PRESETS[idx + 1] : Math.min(20, state.zoom + 1);
            dispatch({ type: 'SET_ZOOM', payload: next });
          }}>+</button>
        </div>
      </div>
    </div>
  );
}
