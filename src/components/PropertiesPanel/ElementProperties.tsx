import { useStore } from '../../store';
import type { CanvasElement, TextElement, RectElement, LineElement, CircleElement, PixelsElement, BitmapElement } from '../../types';
import { U8G2_FONTS, FONT_METRICS } from '../../types';

interface Props {
  selected: CanvasElement;
  containerLabel: string;
  layerId: string | null;
}

export default function ElementProperties({ selected, containerLabel, layerId }: Props) {
  const { state, dispatch } = useStore();

  function update(changes: Partial<CanvasElement>) {
    dispatch({ type: 'UPDATE_ELEMENT', payload: { ...selected, ...changes } as CanvasElement });
  }

  return (
    <div className="panel properties-panel">
      <h3>Properties</h3>

      <div className="prop-group">
        <label>Type / Layer</label>
        <span className="prop-value">{selected.type} · {containerLabel || '—'}</span>
      </div>

      {layerId && (
        <div className="prop-group">
          <label>Move to layer</label>
          <select value={layerId} onChange={(e) => dispatch({ type: 'MOVE_ELEMENT_TO_LAYER', payload: { elementId: selected.id, layerId: e.target.value } })}>
            {state.layers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
        </div>
      )}

      <div className="prop-group">
        <label>Visible</label>
        <input type="checkbox" checked={selected.visible} onChange={(e) => update({ visible: e.target.checked })} />
      </div>

      <div className="prop-row">
        <div className="prop-group"><label>X</label>
          <input type="number" value={selected.x} onChange={(e) => update({ x: Number(e.target.value) })} /></div>
        <div className="prop-group"><label>Y</label>
          <input type="number" value={selected.y} onChange={(e) => update({ y: Number(e.target.value) })} /></div>
      </div>

      {selected.type !== 'text' && selected.type !== 'pixels' && (
        <div className="prop-group">
          <label>Stroke Width</label>
          <input type="number" min={1} max={10} value={selected.strokeWidth}
            onChange={(e) => update({ strokeWidth: Math.max(1, Math.min(10, Number(e.target.value))) })} />
        </div>
      )}

      {selected.type === 'text' && (
        <>
          <div className="prop-group">
            <label>Text</label>
            <input type="text" value={(selected as TextElement).text}
              onChange={(e) => update({ text: e.target.value } as Partial<TextElement>)} placeholder="Hello {temp}°C" />
            <span className="prop-hint">Use {'{var}'} for live data placeholders</span>
          </div>
          <div className="prop-group">
            <label>Font</label>
            <select value={(selected as TextElement).font}
              onChange={(e) => update({ font: e.target.value } as Partial<TextElement>)}>
              {U8G2_FONTS.map((f) => {
                const m = FONT_METRICS[f.value];
                return (<option key={f.value} value={f.value}>{f.label} ({m?.width}×{m?.height}px)</option>);
              })}
            </select>
          </div>
          <div className="prop-group">
            <label>Inverted</label>
            <input type="checkbox" checked={!!(selected as TextElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<TextElement>)} />
          </div>
        </>
      )}

      {selected.type === 'rect' && (
        <>
          <div className="prop-row">
            <div className="prop-group"><label>Width</label>
              <input type="number" value={(selected as RectElement).width}
                onChange={(e) => update({ width: Number(e.target.value) } as Partial<RectElement>)} /></div>
            <div className="prop-group"><label>Height</label>
              <input type="number" value={(selected as RectElement).height}
                onChange={(e) => update({ height: Number(e.target.value) } as Partial<RectElement>)} /></div>
          </div>
          <div className="prop-group"><label>Filled</label>
            <input type="checkbox" checked={(selected as RectElement).filled}
              onChange={(e) => update({ filled: e.target.checked } as Partial<RectElement>)} /></div>
          <div className="prop-group"><label>Subtract (inverted)</label>
            <input type="checkbox" checked={!!(selected as RectElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<RectElement>)} /></div>
        </>
      )}

      {selected.type === 'line' && (
        <>
          <div className="prop-row">
            <div className="prop-group"><label>X2</label>
              <input type="number" value={(selected as LineElement).x2}
                onChange={(e) => update({ x2: Number(e.target.value) } as Partial<LineElement>)} /></div>
            <div className="prop-group"><label>Y2</label>
              <input type="number" value={(selected as LineElement).y2}
                onChange={(e) => update({ y2: Number(e.target.value) } as Partial<LineElement>)} /></div>
          </div>
          <div className="prop-group"><label>Subtract (inverted)</label>
            <input type="checkbox" checked={!!(selected as LineElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<LineElement>)} /></div>
        </>
      )}

      {selected.type === 'circle' && (
        <>
          <div className="prop-group"><label>Radius</label>
            <input type="number" value={(selected as CircleElement).radius}
              onChange={(e) => update({ radius: Number(e.target.value) } as Partial<CircleElement>)} /></div>
          <div className="prop-group"><label>Filled</label>
            <input type="checkbox" checked={(selected as CircleElement).filled}
              onChange={(e) => update({ filled: e.target.checked } as Partial<CircleElement>)} /></div>
          <div className="prop-group"><label>Subtract (inverted)</label>
            <input type="checkbox" checked={!!(selected as CircleElement).inverted}
              onChange={(e) => update({ inverted: e.target.checked } as Partial<CircleElement>)} /></div>
        </>
      )}

      {selected.type === 'pixels' && (
        <div className="prop-group">
          <label>Pixels</label>
          <span className="prop-value">{(selected as PixelsElement).pixels.length} drawn</span>
          <button style={{ marginTop: 4 }} onClick={() => update({ pixels: [] } as unknown as Partial<PixelsElement>)}>Clear Pixels</button>
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
            <button title="Flip horizontally" onClick={() => dispatch({ type: 'TRANSFORM_ELEMENT', payload: { id: selected.id, op: 'flip-h' } })}>⇋ H</button>
            <button title="Flip vertically" onClick={() => dispatch({ type: 'TRANSFORM_ELEMENT', payload: { id: selected.id, op: 'flip-v' } })}>⇵ V</button>
          </div>
          <div className="btn-group" style={{ marginTop: 6 }}>
            {[-90, 90, 180].map((a) => (
              <button key={a} title={`Rotate ${a}°`}
                onClick={() => dispatch({ type: 'TRANSFORM_ELEMENT', payload: { id: selected.id, op: 'rotate', angle: a } })}>
                {a > 0 ? `+${a}°` : `${a}°`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="prop-actions">
        <button onClick={() => dispatch({ type: 'REORDER_ELEMENT', payload: { id: selected.id, direction: 'up' } })}>↑</button>
        <button onClick={() => dispatch({ type: 'REORDER_ELEMENT', payload: { id: selected.id, direction: 'down' } })}>↓</button>
        <button onClick={() => dispatch({ type: 'DUPLICATE_ELEMENT', payload: selected.id })}>⧉</button>
        <button className="btn-danger" onClick={() => dispatch({ type: 'DELETE_ELEMENT', payload: selected.id })}>✕</button>
      </div>
    </div>
  );
}
