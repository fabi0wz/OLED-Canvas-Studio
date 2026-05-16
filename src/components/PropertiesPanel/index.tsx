import { useStore, getAllElements } from '../../store';
import type { CanvasElement } from '../../types';
import WidgetProperties from './WidgetProperties';
import AnimationProperties from './AnimationProperties';
import ElementProperties from './ElementProperties';

export default function PropertiesPanel() {
  const { state } = useStore();

  // Widget editing takes precedence
  const selectedWidget = state.editor.selectedWidgetId
    ? state.widgets.find((w) => w.id === state.editor.selectedWidgetId) ?? null
    : null;
  if (selectedWidget) return <WidgetProperties widget={selectedWidget} />;

  // Animation ref editing
  if (state.selectedId) {
    const refEl = getAllElements(state).find((e) => e.element.id === state.selectedId)?.element;
    if (refEl && refEl.type === 'animationRef') {
      const anim = state.animations.find((a) => a.id === refEl.animationId);
      if (anim) return <AnimationProperties animationId={anim.id} />;
    }
  }

  // Element selection (layers or animation frame)
  const found = state.selectedId
    ? getAllElements(state).find((e) => e.element.id === state.selectedId)
    : null;

  let selected: CanvasElement | null = found?.element ?? null;
  let containerLabel: string = found?.layer?.name ?? '';
  let layerId: string | null = found?.layer?.id ?? null;

  if (!selected && state.selectedId && state.editor.mode === 'animation') {
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    const frame = anim?.frames.find((f) => f.id === state.editor.activeFrameId);
    const el = frame?.elements.find((e) => e.id === state.selectedId);
    if (el && anim && frame) {
      selected = el;
      const idx = anim.frames.indexOf(frame);
      containerLabel = `${anim.name} · frame ${idx + 1}`;
      layerId = null;
    }
  }

  if (!selected) {
    return (
      <div className="panel properties-panel">
        <h3>Properties</h3>
        <p className="muted">Select an element to edit its properties.</p>
      </div>
    );
  }

  return <ElementProperties selected={selected} containerLabel={containerLabel} layerId={layerId} />;
}
