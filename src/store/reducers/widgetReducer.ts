import type { WidgetRefElement } from '../../types';
import type { AppState, Action } from '../types';
import { uid } from '../initialState';
import { makeDefaultWidget } from '../../widgets';
import { addRefToActiveLayer, stripRefs } from '../helpers';

export function reduceWidget(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_WIDGET': {
      const id = uid('widget');
      const cx = Math.floor(state.display.width / 2);
      const cy = Math.floor(state.display.height / 2);
      const w = makeDefaultWidget(action.payload.widgetType, id, action.payload.widgetType, cx, cy);
      const ref: WidgetRefElement = {
        id: uid('widgetref'), type: 'widgetRef', x: w.x, y: w.y,
        visible: true, strokeWidth: 1, widgetId: w.id,
      };
      return {
        ...state,
        widgets: [...state.widgets, w],
        layers: addRefToActiveLayer(state.layers, state.selectedLayerId, ref),
        editor: { ...state.editor, selectedWidgetId: w.id },
        selectedId: ref.id,
      };
    }

    case 'UPDATE_WIDGET': {
      const newWidgets = state.widgets.map((w) => w.id === action.payload.id ? action.payload : w);
      const w = action.payload;
      const newLayers = state.layers.map((l) => ({
        ...l,
        elements: l.elements.map((e) =>
          e.type === 'widgetRef' && e.widgetId === w.id ? { ...e, x: w.x, y: w.y } : e
        ),
      }));
      return { ...state, widgets: newWidgets, layers: newLayers };
    }

    case 'DELETE_WIDGET': {
      const { layers } = stripRefs(state, 'widgetRef', action.payload);
      return {
        ...state,
        widgets: state.widgets.filter((w) => w.id !== action.payload),
        layers,
        editor: { ...state.editor, selectedWidgetId: state.editor.selectedWidgetId === action.payload ? null : state.editor.selectedWidgetId },
      };
    }

    case 'SELECT_WIDGET':
      return { ...state, editor: { ...state.editor, selectedWidgetId: action.payload }, selectedId: null };

    case 'MOVE_WIDGET': {
      const { id, x, y } = action.payload;
      return {
        ...state,
        widgets: state.widgets.map((w) => w.id === id ? { ...w, x, y } : w),
        layers: state.layers.map((l) => ({
          ...l,
          elements: l.elements.map((e) =>
            e.type === 'widgetRef' && e.widgetId === id ? { ...e, x, y } : e
          ),
        })),
      };
    }

    default:
      return state;
  }
}
