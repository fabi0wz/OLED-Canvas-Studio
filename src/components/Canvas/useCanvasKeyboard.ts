import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Action, AppState } from '../../store';

/**
 * Keyboard shortcut handler for the canvas.
 * Registers global keydown listeners for tool switching, delete, and grouping commands.
 */
export function useCanvasKeyboard(
  dispatch: Dispatch<Action>,
  state: AppState,
) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.shiftKey && e.key.toLowerCase() === 'y'))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl+G = group, Ctrl+Shift+G = ungroup, Ctrl+Shift+F = flatten
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'GROUP_ELEMENTS' });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (state.selectedId) dispatch({ type: 'UNGROUP_ELEMENT', payload: state.selectedId });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        dispatch({ type: 'FLATTEN_ELEMENTS' });
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': dispatch({ type: 'SET_TOOL', payload: 'select' }); break;
        case 't': dispatch({ type: 'SET_TOOL', payload: 'add-text' }); break;
        case 'r': dispatch({ type: 'SET_TOOL', payload: 'add-rect' }); break;
        case 'c': dispatch({ type: 'SET_TOOL', payload: 'add-circle' }); break;
        case 'l': dispatch({ type: 'SET_TOOL', payload: 'add-line' }); break;
        case 'd': dispatch({ type: 'SET_TOOL', payload: 'freedraw' }); break;
        case 'e': dispatch({ type: 'SET_TOOL', payload: 'eraser' }); break;
        case 'i': document.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]')?.click(); break;
        case 'delete':
        case 'backspace':
          if (state.editor.selectedWidgetId) dispatch({ type: 'DELETE_WIDGET', payload: state.editor.selectedWidgetId });
          else if (state.selectedId) dispatch({ type: 'DELETE_ELEMENT', payload: state.selectedId });
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch, state.selectedId, state.editor.selectedWidgetId]);
}
