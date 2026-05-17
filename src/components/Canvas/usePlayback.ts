import { useEffect, useState } from 'react';
import type { Dispatch } from 'react';
import type { Action, AppState } from '../../store';

/**
 * Animation playback ticker — advances frames automatically when playing.
 */
export function usePlayback(
  state: AppState,
  dispatch: Dispatch<Action>,
) {
  useEffect(() => {
    if (!state.editor.playing) return;
    const anim = state.animations.find((a) => a.id === state.editor.activeAnimationId);
    if (!anim || anim.frames.length < 2) return;
    const idx = anim.frames.findIndex((f) => f.id === state.editor.activeFrameId);
    const cur = idx >= 0 ? idx : 0;
    const dur = Math.max(16, anim.frames[cur].durationMs);
    const t = setTimeout(() => {
      let next: number;
      if (anim.playMode === 'once') {
        next = cur + 1;
        if (next >= anim.frames.length) { dispatch({ type: 'SET_PLAYING', payload: false }); return; }
      } else {
        next = (cur + 1) % anim.frames.length;
      }
      dispatch({ type: 'SELECT_FRAME', payload: { animationId: anim.id, frameId: anim.frames[next].id } });
    }, dur);
    return () => clearTimeout(t);
  }, [state.editor.playing, state.editor.activeFrameId, state.editor.activeAnimationId, state.animations, dispatch]);
}

/**
 * Clock tick — forces re-render every second when a real-time widget is active.
 */
export function useClockTick(widgets: AppState['widgets']) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasTimeWidget = widgets.some((w) => w.valueSource === 'time' && (w.type === 'analogClock' || w.type === 'digitalClock'));
    if (!hasTimeWidget) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [widgets]);
}
