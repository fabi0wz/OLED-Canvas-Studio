import { useState } from 'react';
import { useStore } from '../store';
import type { TextElement, PixelsElement, AnimationRefElement, WidgetRefElement } from '../types';

export default function LayerPanel() {
  const { state, dispatch } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(id: string, current: string) {
    setEditingId(id);
    setEditValue(current);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      dispatch({ type: 'RENAME_LAYER', payload: { id: editingId, name: editValue.trim() } });
    }
    setEditingId(null);
  }

  return (
    <div className="panel layer-panel">
      <h3>Layers</h3>

      <div className="layer-controls">
        <button onClick={() => dispatch({ type: 'ADD_LAYER' })} title="Add layer">+ Layer</button>
      </div>

      <ul className="layer-list">
        {[...state.layers].reverse().map((layer) => {
          // Reverse so top-most rendered layer appears at the top of the list (Photoshop-style)
          const isActive = layer.id === state.selectedLayerId;
          const isEditing = editingId === layer.id;

          return (
            <li key={layer.id} className={`layer-item ${isActive ? 'active' : ''}`}>
              <div
                className="layer-row"
                onClick={() => dispatch({ type: 'SELECT_LAYER', payload: layer.id })}
              >
                <button
                  className={`layer-eye ${layer.visible ? 'on' : 'off'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'TOGGLE_LAYER_VISIBLE', payload: layer.id });
                  }}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? '●' : '○'}
                </button>
                {isEditing ? (
                  <input
                    className="layer-name-edit"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="layer-name"
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(layer.id, layer.name); }}
                    title="Double-click to rename"
                  >
                    {layer.name}
                  </span>
                )}
                <span className="layer-count">{layer.elements.length}</span>
                <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    title="Move up"
                    onClick={() => dispatch({ type: 'REORDER_LAYER', payload: { id: layer.id, direction: 'down' } })}
                  >↑</button>
                  <button
                    title="Move down"
                    onClick={() => dispatch({ type: 'REORDER_LAYER', payload: { id: layer.id, direction: 'up' } })}
                  >↓</button>
                  <button
                    className="btn-danger"
                    title="Delete layer"
                    disabled={state.layers.length <= 1}
                    onClick={() => {
                      if (state.layers.length > 1 && confirm(`Delete layer "${layer.name}"?`)) {
                        dispatch({ type: 'DELETE_LAYER', payload: layer.id });
                      }
                    }}
                  >✕</button>
                </div>
              </div>

              {layer.elements.length > 0 && (
                <ul className="layer-elements">
                  {layer.elements.map((el) => {
                    let label: string;
                    if (el.type === 'text') label = `"${(el as TextElement).text}"`;
                    else if (el.type === 'pixels') label = `${(el as PixelsElement).pixels.length}px`;
                    else if (el.type === 'animationRef') {
                      const anim = state.animations.find((a) => a.id === (el as AnimationRefElement).animationId);
                      label = `ANIM: ${anim?.name ?? '?'}`;
                    } else if (el.type === 'widgetRef') {
                      const wgt = state.widgets.find((w) => w.id === (el as WidgetRefElement).widgetId);
                      label = `WIDGET: ${wgt?.type ?? '?'}`;
                    } else label = `(${el.x},${el.y})`;
                    return (
                      <li
                        key={el.id}
                        className={el.id === state.selectedId ? 'selected' : ''}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'SELECT_ELEMENT', payload: el.id });
                          if (el.type === 'widgetRef') {
                            dispatch({ type: 'SELECT_WIDGET', payload: (el as WidgetRefElement).widgetId });
                          } else if (el.type === 'animationRef') {
                            dispatch({ type: 'SELECT_ANIMATION', payload: (el as AnimationRefElement).animationId });
                          } else {
                            dispatch({ type: 'SELECT_WIDGET', payload: null });
                          }
                        }}
                      >
                        <span className={`el-type el-type-${el.type}`}>{el.type}</span>
                        <span className={el.visible ? 'el-label' : 'el-label muted'}>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
