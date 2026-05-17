import type { CanvasElement, GroupElement } from '../../types';
import { FONT_METRICS } from '../../types';
import { getWidgetBounds } from '../../widgets';
import type { AppState } from '../../store';

/**
 * Compute the bounding box for any element in display-pixel coordinates.
 * Used for selection outlines, hit testing, and resize handles.
 */
export function getElementBounds(
  el: CanvasElement,
  state: AppState,
): { x: number; y: number; w: number; h: number } {
  switch (el.type) {
    case 'text': {
      const metrics = FONT_METRICS[el.font] || { width: 6, height: 10 };
      const textW = el.text.length * metrics.width;
      return { x: el.x, y: el.y - metrics.height, w: textW, h: metrics.height };
    }
    case 'rect':
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    case 'line': {
      const minX = Math.min(el.x, el.x2);
      const minY = Math.min(el.y, el.y2);
      return { x: minX, y: minY, w: Math.max(Math.max(el.x, el.x2) - minX, 1), h: Math.max(Math.max(el.y, el.y2) - minY, 1) };
    }
    case 'circle':
      return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2 + 1, h: el.radius * 2 + 1 };
    case 'pixels': {
      if (el.pixels.length === 0) return { x: el.x, y: el.y, w: 1, h: 1 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of el.pixels) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
      return { x: el.x + minX, y: el.y + minY, w: Math.max(maxX - minX + 1, 1), h: Math.max(maxY - minY + 1, 1) };
    }
    case 'bitmap':
      return { x: el.x, y: el.y, w: el.bmpWidth, h: el.bmpHeight };
    case 'animationRef': {
      const anim = state.animations.find((a) => a.id === el.animationId);
      if (!anim) return { x: el.x, y: el.y, w: 1, h: 1 };
      return { x: el.x, y: el.y, w: state.display.width, h: state.display.height };
    }
    case 'widgetRef': {
      const wgt = state.widgets.find((w) => w.id === el.widgetId);
      if (!wgt) return { x: el.x, y: el.y, w: 1, h: 1 };
      return getWidgetBounds(wgt);
    }
    case 'group': {
      const g = el as GroupElement;
      if (g.children.length === 0) return { x: g.x, y: g.y, w: 1, h: 1 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of g.children) {
        const cb = getElementBounds({ ...c, x: c.x + g.x, y: c.y + g.y } as CanvasElement, state);
        if (cb.x < minX) minX = cb.x;
        if (cb.y < minY) minY = cb.y;
        if (cb.x + cb.w > maxX) maxX = cb.x + cb.w;
        if (cb.y + cb.h > maxY) maxY = cb.y + cb.h;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
}
