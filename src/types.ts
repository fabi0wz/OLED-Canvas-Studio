export interface DisplayConfig {
  type: string;
  width: number;
  height: number;
}

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  visible: boolean;
  strokeWidth: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  font: string;
  align: 'left' | 'center' | 'right';
  inverted?: boolean;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  width: number;
  height: number;
  filled: boolean;
  inverted?: boolean;
}

export interface LineElement extends BaseElement {
  type: 'line';
  x2: number;
  y2: number;
  inverted?: boolean;
}

export interface CircleElement extends BaseElement {
  type: 'circle';
  radius: number;
  filled: boolean;
  inverted?: boolean;
}

export interface PixelsElement extends BaseElement {
  type: 'pixels';
  pixels: [number, number][];
}

export interface BitmapElement extends BaseElement {
  type: 'bitmap';
  /** Width of the bitmap in pixels */
  bmpWidth: number;
  /** Height of the bitmap in pixels */
  bmpHeight: number;
  /** Row-major 1-bit data: 1 = white pixel, 0 = black */
  data: Uint8Array;
}

/** Layer-level reference to a frame animation. Its x/y mirror the animation's own offset. */
export interface AnimationRefElement extends BaseElement {
  type: 'animationRef';
  animationId: string;
}

/** Layer-level reference to a procedural widget. Its x/y mirror the widget's own position. */
export interface WidgetRefElement extends BaseElement {
  type: 'widgetRef';
  widgetId: string;
}

export type CanvasElement =
  | TextElement | RectElement | LineElement | CircleElement
  | PixelsElement | BitmapElement
  | AnimationRefElement | WidgetRefElement;

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  elements: CanvasElement[];
}

export interface Project {
  display: DisplayConfig;
  layers: Layer[];
  /** Pixels manually erased by user (applied last, suppresses any element output) */
  erasedPixels?: [number, number][];
  // Legacy support — old projects may only have a flat elements array
  elements?: CanvasElement[];
  /** Frame-by-frame animations placed on the same scene. */
  animations?: FrameAnimation[];
  /** Procedural / data-driven widgets placed on the same scene. */
  widgets?: ProceduralWidget[];
}

/* ---------- Frame animations ------------------------------------------- */

export interface Frame {
  id: string;
  /** Frame display duration in milliseconds. */
  durationMs: number;
  /** Drawable content — uses the same primitive elements as static layers. */
  elements: CanvasElement[];
}

export type AnimationPlayMode = 'loop' | 'once' | 'pingpong';

export interface FrameAnimation {
  id: string;
  name: string;
  visible: boolean;
  /** Render offset applied to every frame (so an animation can be moved as a whole). */
  x: number;
  y: number;
  frames: Frame[];
  playMode: AnimationPlayMode;
}

/* ---------- Procedural widgets ----------------------------------------- */

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

export const DISPLAY_PRESETS: DisplayConfig[] = [
  { type: 'SSD1306_128x64', width: 128, height: 64 },
  { type: 'SSD1306_128x32', width: 128, height: 32 },
  { type: 'SH1106_128x64', width: 128, height: 64 },
  { type: 'SSD1309_128x64', width: 128, height: 64 },
  { type: 'SSD1306_64x48', width: 64, height: 48 },
  { type: 'SSD1306_72x40', width: 72, height: 40 },
  { type: 'SH1107_128x128', width: 128, height: 128 },
  { type: 'SH1107_64x128', width: 64, height: 128 },
];

export const U8G2_FONTS = [
  { label: '6x10', value: 'u8g2_font_6x10_tr' },
  { label: '5x7', value: 'u8g2_font_5x7_tr' },
  { label: '7x13', value: 'u8g2_font_7x13_tr' },
  { label: '8x13', value: 'u8g2_font_8x13_tr' },
  { label: '9x15', value: 'u8g2_font_9x15_tr' },
  { label: '10x20', value: 'u8g2_font_10x20_tr' },
];

// Approximate character widths for canvas rendering
export const FONT_METRICS: Record<string, { width: number; height: number }> = {
  'u8g2_font_6x10_tr': { width: 6, height: 10 },
  'u8g2_font_5x7_tr': { width: 5, height: 7 },
  'u8g2_font_7x13_tr': { width: 7, height: 13 },
  'u8g2_font_8x13_tr': { width: 8, height: 13 },
  'u8g2_font_9x15_tr': { width: 9, height: 15 },
  'u8g2_font_10x20_tr': { width: 10, height: 20 },
};

export const SNAP_PRESETS = [0, 1, 2, 4, 8, 16];
