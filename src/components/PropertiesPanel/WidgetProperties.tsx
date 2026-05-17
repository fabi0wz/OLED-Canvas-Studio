import type { ProceduralWidget } from '../../types';
import { U8G2_FONTS, WIDGET_LABELS } from '../../types';
import { useStore } from '../../store';

export default function WidgetProperties({ widget }: { widget: ProceduralWidget }) {
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

      <div className="prop-group">
        <label>Inverted (draw black on white)</label>
        <input type="checkbox" checked={widget.inverted} onChange={(e) => update({ inverted: e.target.checked })} />
      </div>

      <div className="prop-row">
        <div className="prop-group"><label>X</label>
          <input type="number" value={widget.x} onChange={(e) => update({ x: Number(e.target.value) })} /></div>
        <div className="prop-group"><label>Y</label>
          <input type="number" value={widget.y} onChange={(e) => update({ y: Number(e.target.value) })} /></div>
      </div>

      <div className="prop-group">
        <label>Value source</label>
        <select value={widget.valueSource} onChange={(e) => update({ valueSource: e.target.value as ProceduralWidget['valueSource'] })}>
          <option value="sim">simulated (constant)</option>
          <option value="time">current time</option>
          <option value="variable">live variable</option>
        </select>
      </div>

      {widget.valueSource === 'variable' && (
        <div className="prop-group">
          <label>Variable name (C identifier)</label>
          <input type="text" value={widget.variableName ?? ''} placeholder="e.g. battery_pct"
            onChange={(e) => update({ variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} />
        </div>
      )}

      <div className="prop-row">
        <div className="prop-group"><label>Min</label>
          <input type="number" value={widget.min} onChange={(e) => update({ min: Number(e.target.value) })} /></div>
        <div className="prop-group"><label>Max</label>
          <input type="number" value={widget.max} onChange={(e) => update({ max: Number(e.target.value) })} /></div>
      </div>

      <div className="prop-group">
        <label>Sim value (preview)</label>
        <input type="range" min={widget.min} max={widget.max}
          step={Math.max(1, Math.round((widget.max - widget.min) / 100))}
          value={widget.simValue} onChange={(e) => update({ simValue: Number(e.target.value) })} />
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
              {U8G2_FONTS.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
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
        <button className="btn-danger" onClick={() => dispatch({ type: 'DELETE_WIDGET', payload: widget.id })}>✕ Delete</button>
      </div>
    </div>
  );
}
