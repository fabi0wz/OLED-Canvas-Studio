export type WidgetType =
  | 'analogClock'
  | 'digitalClock'
  | 'progressBar'
  | 'meter'
  | 'gauge'
  | 'battery';

export type WidgetValueSource = 'sim' | 'time' | 'variable';

export interface WidgetBase {
  id: string;
  name: string;
  type: WidgetType;
  visible: boolean;
  x: number;
  y: number;
  /** Where the runtime value comes from: simulated, current time, or a named variable. */
  valueSource: WidgetValueSource;
  /** Name of the live variable (when valueSource === 'variable') — referenced from generated code. */
  variableName?: string;
  /** Simulated value used for editor preview. */
  simValue: number;
  /** Min / max numeric range for value-driven widgets. */
  min: number;
  max: number;
  /** If true, pixels are cleared instead of set (draws in black on a white background). */
  inverted: boolean;
}

export interface AnalogClockWidget extends WidgetBase {
  type: 'analogClock';
  radius: number;
  showTicks: boolean;
  showSecondHand: boolean;
}

export interface DigitalClockWidget extends WidgetBase {
  type: 'digitalClock';
  font: string;
  /** Format string with H/M/S tokens, e.g. "HH:MM:SS". */
  format: string;
}

export interface ProgressBarWidget extends WidgetBase {
  type: 'progressBar';
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
}

export interface MeterWidget extends WidgetBase {
  type: 'meter';
  width: number;
  height: number;
  /** Number of tick segments. */
  segments: number;
}

export interface GaugeWidget extends WidgetBase {
  type: 'gauge';
  radius: number;
  /** Sweep arc in degrees. Needle starts at `-sweep/2` from straight up. */
  sweepDeg: number;
  showTicks: boolean;
}

export interface BatteryWidget extends WidgetBase {
  type: 'battery';
  width: number;
  height: number;
}

export type ProceduralWidget =
  | AnalogClockWidget
  | DigitalClockWidget
  | ProgressBarWidget
  | MeterWidget
  | GaugeWidget
  | BatteryWidget;

export const WIDGET_LABELS: Record<WidgetType, string> = {
  analogClock: 'Analog Clock',
  digitalClock: 'Digital Clock',
  progressBar: 'Progress Bar',
  meter: 'Meter',
  gauge: 'Gauge',
  battery: 'Battery',
};
