import { useStore } from '../../store';

export default function AnimationProperties({ animationId }: { animationId: string }) {
  const { state, dispatch } = useStore();
  const anim = state.animations.find((a) => a.id === animationId);
  if (!anim) return null;

  function update(changes: Partial<typeof anim & { x: number }>) {
    dispatch({ type: 'UPDATE_ANIMATION', payload: { id: animationId, changes: changes as object } });
  }

  return (
    <div className="panel properties-panel">
      <h3>Animation · {anim.name}</h3>

      <div className="prop-group">
        <label>Name</label>
        <input type="text" value={anim.name} onChange={(e) => dispatch({ type: 'RENAME_ANIMATION', payload: { id: animationId, name: e.target.value } })} />
      </div>

      <div className="prop-group">
        <label>Visible</label>
        <input type="checkbox" checked={anim.visible} onChange={() => dispatch({ type: 'TOGGLE_ANIMATION_VISIBLE', payload: animationId })} />
      </div>

      <div className="prop-row">
        <div className="prop-group"><label>X</label>
          <input type="number" value={anim.x} onChange={(e) => update({ x: Number(e.target.value) })} /></div>
        <div className="prop-group"><label>Y</label>
          <input type="number" value={anim.y} onChange={(e) => update({ y: Number(e.target.value) })} /></div>
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
        <button onClick={() => dispatch({ type: 'SELECT_ANIMATION', payload: animationId })}>Edit frames</button>
        <button className="btn-danger" onClick={() => dispatch({ type: 'DELETE_ANIMATION', payload: animationId })}>Delete</button>
      </div>
    </div>
  );
}
