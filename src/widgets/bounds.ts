import type {
  ProceduralWidget, AnalogClockWidget, DigitalClockWidget,
  ProgressBarWidget, MeterWidget, BatteryWidget, GaugeWidget,
} from '../types';
import { FONT_METRICS } from '../types';
import { formatClock } from './helpers';

/** Bounding box of the widget in display-pixel coordinates. */
export function getWidgetBounds(w: ProceduralWidget): { x: number; y: number; w: number; h: number } {
  switch (w.type) {
    case 'analogClock':
    case 'gauge': {
      const r = (w as AnalogClockWidget | GaugeWidget).radius;
      return { x: w.x - r, y: w.y - r, w: r * 2 + 1, h: r * 2 + 1 };
    }
    case 'digitalClock': {
      const dw = w as DigitalClockWidget;
      const metrics = FONT_METRICS[dw.font] || { width: 6, height: 10 };
      const txt = formatClock(dw.format, new Date());
      return { x: w.x, y: w.y - metrics.height, w: Math.max(1, txt.length * metrics.width), h: metrics.height };
    }
    default: {
      const dw = w as ProgressBarWidget | MeterWidget | BatteryWidget;
      return { x: dw.x, y: dw.y, w: dw.width, h: dw.height };
    }
  }
}
