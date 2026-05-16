import { useStore } from '../store';
import type { WidgetType } from '../types';
import { WIDGET_LABELS } from '../types';

const PALETTE: WidgetType[] = ['analogClock', 'digitalClock', 'progressBar', 'meter', 'gauge', 'battery'];

export default function WidgetPanel() {
  const { state, dispatch } = useStore();

  return (
    <div className="panel widget-panel">
      <h3>Widget Palette</h3>
      <div className="widget-palette">
        {PALETTE.map((t) => (
          <button
            key={t}
            className="widget-palette-btn"
            onClick={() => dispatch({ type: 'ADD_WIDGET', payload: { widgetType: t } })}
            title={`Add ${WIDGET_LABELS[t]}`}
          >+ {WIDGET_LABELS[t]}</button>
        ))}
      </div>

      <h3 style={{ marginTop: 12 }}>Widgets in scene</h3>
      <ul className="layer-list">
        {state.widgets.map((w) => {
          const isActive = w.id === state.editor.selectedWidgetId;
          return (
            <li key={w.id} className={`layer-item ${isActive ? 'active' : ''}`}>
              <div className="layer-row" onClick={() => dispatch({ type: 'SELECT_WIDGET', payload: w.id })}>
                <button
                  className={`layer-eye ${w.visible ? 'on' : 'off'}`}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_WIDGET', payload: { ...w, visible: !w.visible } }); }}
                >{w.visible ? '●' : '○'}</button>
                <span className="layer-name">{w.name}</span>
                <span className="layer-count">{w.type}</span>
                <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-danger" title="Delete"
                    onClick={() => dispatch({ type: 'DELETE_WIDGET', payload: w.id })}
                  >✕</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {state.widgets.length === 0 && <p className="muted">No widgets yet. Click a palette button to add one.</p>}
    </div>
  );
}
