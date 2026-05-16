import { useStore, getAllElements } from '../store';
import type {
  CanvasElement, TextElement, RectElement, LineElement, CircleElement, PixelsElement, BitmapElement,
  ProceduralWidget,
} from '../types';
import { U8G2_FONTS, FONT_METRICS, WIDGET_LABELS } from '../types';

export default function PropertiesPanel() {
  const { state, dispatch } = useStore();

  // ---- Widget editing takes precedence when a widget is selected. ----
  const selectedWidget = state.editor.selectedWidgetId
    ? state.widgets.find((w) => w.id === state.editor.selectedWidgetId) ?? null
    : null;
  if (selectedWidget) return <WidgetProperties widget={selectedWidget} />;

  // ---- Animation ref editing: when an animationRef is selected. ----
  if (state.selectedId) {
    const refEl = getAllElements(state).find((e) => e.element.id === state.selectedId)?.element;
    if (refEl && refEl.type === 'animationRef') {
      const anim = state.animations.find((a) => a.id === refEl.animationId);
      if (anim) return <AnimationProperties animationId={anim.id} />;
    }
  }

  const found = state.selectedId
    ? getAllElements(state).find((e) => e.element.id === state.selectedId)
    : null;
  // In animation mode the selection may live inside the active frame; look it up there as a fallback.
  let selected: CanvasElement | null = found?.element ?? null;
  let containerLabel: string = found?.layer?.name ?? '';
  if (!selected && state.selectedId && state.editor.mode === 'animation') {
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    const frame = anim?.frames.find((f) => f.id === state.editor.activeFrameId);
    const el = frame?.elements.find((e) => e.id === state.selectedId);
    if (el && anim && frame) {
      selected = el;
      const idx = anim.frames.indexOf(frame);
      containerLabel = `${anim.name} · frame ${idx + 1}`;
    }
  }
  const layer = found?.layer ?? null;

  if (!selected) {
    return (
      <div className="panel properties-panel">
        <h3>Properties</h3>
        <p className="muted">Select an element to edit its properties.</p>
      </div>
    );
  }

  function update(changes: Partial<CanvasElement>) {
    if (!selected) return;
    dispatch({ type: 'UPDATE_ELEMENT', payload: { ...selected, ...changes } as CanvasElement });
  }

  return (
    <div className="panel properties-panel">
      <h3>Properties</h3>

      <div className="prop-group">
        <label>Type / Layer</label>
        <span className="prop-value">{selected.type} · {containerLabel || layer?.name || '—'}</span>
      </div>

      {/* Layer move only makes sense for elements in a layer (static mode). */}
      {layer && (
        <div className="prop-group">
          <label>Move to layer</label>
          <select
            value={layer?.id ?? ''}
            onChange={(e) => dispatch({ type: 'MOVE_ELEMENT_TO_LAYER', payload: { elementId: selected!.id, layerId: e.target.value } })}
          >
            {state.layers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="prop-group">
        <label>Visible</label>
        <input
          type="checkbox"
          checked={selected.visible}
          onChange={(e) => update({ visible: e.target.checked })}
        />
      </div>

      <div className="prop-row">
        <div className="prop-group">
          <label>X</label>
          <input type="number" value={selected.x} onChange={(e) => update({ x: Number(e.target.value) })} />
        </div>
        <div className="prop-group">
          <label>Y</label>
          <input type="number" value={selected.y} onChange={(e) => update({ y: Number(e.target.value) })} />
        </div>
      </div>

      {selected.type !== 'text' && selected.type !== 'pixels' && (
        <div className="prop-group">
          <label>Stroke Width</label>
          <input
            type="number"
            min={1}
            max={10}
            value={selected.strokeWidth}
            onChange={(e) => update({ strokeWidth: Math.max(1, Math.min(10, Number(e.target.value))) })}
          />
        </div>
      )}

      {selected.type === 'text' && (
        <>
          <div className="prop-group">
            <label>Text</label>
            <input
              type="text"
              value={(selected as TextElement).text}
              onChange={(e) => update({ text: e.target.value } as Partial<TextElement>)}
              placeholder="Hello {temp}°C"
            />
            <span className="prop-hint">Use {'{var}'} for live data placeholders</span>
          </div>
          <div className="prop-group">
            <label>Font</label>
            <select
              value={(selected as TextElement).font}
              onChange={(e) => update({ font: e.target.value } as Partial<TextElement>)}
            >
              {U8G2_FONTS.map((f) => {
                const m = FONT_METRICS[f.value];
                return (
                  <option key={f.value} value={f.value}>{f.label} ({m?.width}×{m?.height}px)</option>
                );
              })}
            </select>
          </div>

          <div className="prop-group">
            <label>Inverted</label>
            <input
              type="checkbox"
              checked={!!(selected as TextElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<TextElement>)}
            />
          </div>
        </>
      )}

      {selected.type === 'rect' && (
        <>
          <div className="prop-row">
            <div className="prop-group">
              <label>Width</label>
              <input
                type="number"
                value={(selected as RectElement).width}
                onChange={(e) => update({ width: Number(e.target.value) } as Partial<RectElement>)}
              />
            </div>
            <div className="prop-group">
              <label>Height</label>
              <input
                type="number"
                value={(selected as RectElement).height}
                onChange={(e) => update({ height: Number(e.target.value) } as Partial<RectElement>)}
              />
            </div>
          </div>
          <div className="prop-group">
            <label>Filled</label>
            <input
              type="checkbox"
              checked={(selected as RectElement).filled}
              onChange={(e) => update({ filled: e.target.checked } as Partial<RectElement>)}
            />
          </div>
          <div className="prop-group">
            <label>Subtract (inverted)</label>
            <input
              type="checkbox"
              checked={!!(selected as RectElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<RectElement>)}
            />
          </div>
        </>
      )}

      {selected.type === 'line' && (
        <div className="prop-row">
          <div className="prop-group">
            <label>X2</label>
            <input
              type="number"
              value={(selected as LineElement).x2}
              onChange={(e) => update({ x2: Number(e.target.value) } as Partial<LineElement>)}
            />
          </div>
          <div className="prop-group">
            <label>Y2</label>
            <input
              type="number"
              value={(selected as LineElement).y2}
              onChange={(e) => update({ y2: Number(e.target.value) } as Partial<LineElement>)}
            />
          </div>
        </div>
      )}

      {selected.type === 'line' && (
        <div className="prop-group">
          <label>Subtract (inverted)</label>
          <input
            type="checkbox"
            checked={!!(selected as LineElement).inverted}
            onChange={(e) => update({ inverted: e.target.checked } as Partial<LineElement>)}
          />
        </div>
      )}

      {selected.type === 'circle' && (
        <>
          <div className="prop-group">
            <label>Radius</label>
            <input
              type="number"
              value={(selected as CircleElement).radius}
              onChange={(e) => update({ radius: Number(e.target.value) } as Partial<CircleElement>)}
            />
          </div>
          <div className="prop-group">
            <label>Filled</label>
            <input
              type="checkbox"
              checked={(selected as CircleElement).filled}
              onChange={(e) => update({ filled: e.target.checked } as Partial<CircleElement>)}
            />
          </div>
          <div className="prop-group">
            <label>Subtract (inverted)</label>
            <input
              type="checkbox"
              checked={!!(selected as CircleElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<CircleElement>)}
            />
          </div>
        </>
      )}

      {selected.type === 'pixels' && (
        <div className="prop-group">
          <label>Pixels</label>
          <span className="prop-value">{(selected as PixelsElement).pixels.length} drawn</span>
          <button
            style={{ marginTop: 4 }}
            onClick={() => update({ pixels: [] } as unknown as Partial<PixelsElement>)}
          >Clear Pixels</button>
        </div>
      )}

      {selected.type === 'bitmap' && (
        <div className="prop-group">
          <label>Bitmap</label>
          <span className="prop-value">{(selected as BitmapElement).bmpWidth}×{(selected as BitmapElement).bmpHeight} px</span>
        </div>
      )}

      {selected.type !== 'text' && (
        <div className="prop-group">
          <label>Transform</label>
          <div className="btn-group">
            <button
              title="Flip horizontally"
              onClick={() => dispatch({ type: 'TRANSFORM_ELEMENT', payload: { id: selected!.id, op: 'flip-h' } })}
            >⇋ H</button>
            <button
              title="Flip vertically"
              onClick={() => dispatch({ type: 'TRANSFORM_ELEMENT', payload: { id: selected!.id, op: 'flip-v' } })}
            >⇵ V</button>
          </div>
          <div className="btn-group" style={{ marginTop: 6 }}>
            {[-90, 90, 180].map((a) => (
              <button
                key={a}
                title={`Rotate ${a}°`}
                onClick={() => dispatch({ type: 'TRANSFORM_ELEMENT', payload: { id: selected!.id, op: 'rotate', angle: a } })}
              >{a > 0 ? `+${a}°` : `${a}°`}</button>
            ))}
          </div>
        </div>
      )}

      <div className="prop-actions">
        <button onClick={() => dispatch({ type: 'REORDER_ELEMENT', payload: { id: selected.id, direction: 'up' } })} title="Move up in layer">↑</button>
        <button onClick={() => dispatch({ type: 'REORDER_ELEMENT', payload: { id: selected.id, direction: 'down' } })} title="Move down in layer">↓</button>
        <button onClick={() => dispatch({ type: 'DUPLICATE_ELEMENT', payload: selected.id })} title="Duplicate">⧉</button>
        <button className="btn-danger" onClick={() => dispatch({ type: 'DELETE_ELEMENT', payload: selected.id })} title="Delete">✕</button>
      </div>
    </div>
  );
}

/* =========================================================================
   Widget properties — shown when a procedural widget is selected.
   ========================================================================= */

function WidgetProperties({ widget }: { widget: ProceduralWidget }) {
  const { dispatch } = useStore();

  function update(changes: Partial<ProceduralWidget>) {
    dispatch({ type: 'UPDATE_WIDGET', payload: { ...widget, ...changes } as ProceduralWidget });
  }

  return (
    <div className="panel properties-panel">
      <h3>Widget · {WIDGET_LABELS[widget.type]}</h3>

      <div className="prop-group">
        <label>Name</label>
        <input type="text" value={widget.name} onChange={(e) => update({ name: e.target.value })} />
      </div>

      <div className="prop-group">
        <label>Visible</label>
        <input type="checkbox" checked={widget.visible} onChange={(e) => update({ visible: e.target.checked })} />
      </div>

      <div className="prop-row">
        <div className="prop-group">
          <label>X</label>
          <input type="number" value={widget.x} onChange={(e) => update({ x: Number(e.target.value) })} />
        </div>
        <div className="prop-group">
          <label>Y</label>
          <input type="number" value={widget.y} onChange={(e) => update({ y: Number(e.target.value) })} />
        </div>
      </div>

      <div className="prop-group">
        <label>Value source</label>
        <select
          value={widget.valueSource}
          onChange={(e) => update({ valueSource: e.target.value as ProceduralWidget['valueSource'] })}
        >
          <option value="sim">simulated (constant)</option>
          <option value="time">current time</option>
          <option value="variable">live variable</option>
        </select>
      </div>

      {widget.valueSource === 'variable' && (
        <div className="prop-group">
          <label>Variable name (C identifier)</label>
          <input
            type="text"
            value={widget.variableName ?? ''}
            placeholder="e.g. battery_pct"
            onChange={(e) => update({ variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
          />
        </div>
      )}

      <div className="prop-row">
        <div className="prop-group">
          <label>Min</label>
          <input type="number" value={widget.min} onChange={(e) => update({ min: Number(e.target.value) })} />
        </div>
        <div className="prop-group">
          <label>Max</label>
          <input type="number" value={widget.max} onChange={(e) => update({ max: Number(e.target.value) })} />
        </div>
      </div>

      <div className="prop-group">
        <label>Sim value (preview)</label>
        <input
          type="range"
          min={widget.min}
          max={widget.max}
          step={Math.max(1, Math.round((widget.max - widget.min) / 100))}
          value={widget.simValue}
          onChange={(e) => update({ simValue: Number(e.target.value) })}
        />
        <span className="prop-hint">{widget.simValue}</span>
      </div>

      {widget.type === 'analogClock' && (
        <>
          <div className="prop-group"><label>Radius</label>
            <input type="number" value={widget.radius} onChange={(e) => update({ radius: Number(e.target.value) })} /></div>
          <div className="prop-group"><label>Show ticks</label>
            <input type="checkbox" checked={widget.showTicks} onChange={(e) => update({ showTicks: e.target.checked })} /></div>
          <div className="prop-group"><label>Second hand</label>
            <input type="checkbox" checked={widget.showSecondHand} onChange={(e) => update({ showSecondHand: e.target.checked })} /></div>
        </>
      )}

      {widget.type === 'digitalClock' && (
        <>
          <div className="prop-group"><label>Format</label>
            <input type="text" value={widget.format} onChange={(e) => update({ format: e.target.value })} placeholder="HH:MM:SS" /></div>
          <div className="prop-group"><label>Font</label>
            <select value={widget.font} onChange={(e) => update({ font: e.target.value })}>
              {U8G2_FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select></div>
        </>
      )}

      {(widget.type === 'progressBar' || widget.type === 'meter' || widget.type === 'battery') && (
        <div className="prop-row">
          <div className="prop-group"><label>Width</label>
            <input type="number" value={widget.width} onChange={(e) => update({ width: Number(e.target.value) })} /></div>
          <div className="prop-group"><label>Height</label>
            <input type="number" value={widget.height} onChange={(e) => update({ height: Number(e.target.value) })} /></div>
        </div>
      )}

      {widget.type === 'progressBar' && (
        <div className="prop-group"><label>Orientation</label>
          <select value={widget.orientation} onChange={(e) => update({ orientation: e.target.value as 'horizontal' | 'vertical' })}>
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
          </select></div>
      )}

      {widget.type === 'meter' && (
        <div className="prop-group"><label>Segments</label>
          <input type="number" min={2} max={32} value={widget.segments} onChange={(e) => update({ segments: Math.max(2, Number(e.target.value)) })} /></div>
      )}

      {widget.type === 'gauge' && (
        <>
          <div className="prop-group"><label>Radius</label>
            <input type="number" value={widget.radius} onChange={(e) => update({ radius: Number(e.target.value) })} /></div>
          <div className="prop-group"><label>Sweep (°)</label>
            <input type="number" min={30} max={360} value={widget.sweepDeg} onChange={(e) => update({ sweepDeg: Number(e.target.value) })} /></div>
          <div className="prop-group"><label>Show ticks</label>
            <input type="checkbox" checked={widget.showTicks} onChange={(e) => update({ showTicks: e.target.checked })} /></div>
        </>
      )}

      <div className="prop-actions">
        <button className="btn-danger" onClick={() => dispatch({ type: 'DELETE_WIDGET', payload: widget.id })} title="Delete">✕ Delete</button>
      </div>
    </div>
  );
}

/* =========================================================================
   Animation properties � shown when an animationRef is selected.
   ========================================================================= */

function AnimationProperties({ animationId }: { animationId: string }) {
  const { state, dispatch } = useStore();
  const anim = state.animations.find((a) => a.id === animationId);
  if (!anim) return null;

  function update(changes: Partial<typeof anim & { x: number }>) {
    dispatch({ type: 'UPDATE_ANIMATION', payload: { id: animationId, changes: changes as object } });
  }

  return (
    <div className="panel properties-panel">
      <h3>Animation � {anim.name}</h3>

      <div className="prop-group">
        <label>Name</label>
        <input type="text" value={anim.name} onChange={(e) => dispatch({ type: 'RENAME_ANIMATION', payload: { id: animationId, name: e.target.value } })} />
      </div>

      <div className="prop-group">
        <label>Visible</label>
        <input type="checkbox" checked={anim.visible} onChange={() => dispatch({ type: 'TOGGLE_ANIMATION_VISIBLE', payload: animationId })} />
      </div>

      <div className="prop-row">
        <div className="prop-group">
          <label>X</label>
          <input type="number" value={anim.x} onChange={(e) => update({ x: Number(e.target.value) })} />
        </div>
        <div className="prop-group">
          <label>Y</label>
          <input type="number" value={anim.y} onChange={(e) => update({ y: Number(e.target.value) })} />
        </div>
      </div>

      <div className="prop-group">
        <label>Play mode</label>
        <select value={anim.playMode} onChange={(e) => update({ playMode: e.target.value as 'loop' | 'once' | 'pingpong' })}>
          <option value="loop">Loop</option>
          <option value="once">Once</option>
          <option value="pingpong">Ping-pong</option>
        </select>
      </div>

      <div className="prop-group">
        <label>Frames</label>
        <span className="prop-value">{anim.frames.length}</span>
      </div>

      <div className="prop-actions">
        <button onClick={() => dispatch({ type: 'SELECT_ANIMATION', payload: animationId })} title="Edit frames">Edit frames</button>
        <button className="btn-danger" onClick={() => dispatch({ type: 'DELETE_ANIMATION', payload: animationId })} title="Delete">Delete</button>
      </div>
    </div>
  );
}
