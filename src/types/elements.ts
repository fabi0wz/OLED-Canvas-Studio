export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  visible: boolean;
  strokeWidth: number;
  inverted?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  font: string;
  align: 'left' | 'center' | 'right';
}

export interface RectElement extends BaseElement {
  type: 'rect';
  width: number;
  height: number;
  filled: boolean;
}

export interface LineElement extends BaseElement {
  type: 'line';
  x2: number;
  y2: number;
}

export interface CircleElement extends BaseElement {
  type: 'circle';
  radius: number;
  filled: boolean;
}

export interface PixelsElement extends BaseElement {
  type: 'pixels';
  pixels: [number, number][];
}

export interface GroupElement extends BaseElement {
  type: 'group';
  children: CanvasElement[];
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
  | PixelsElement | BitmapElement | GroupElement
  | AnimationRefElement | WidgetRefElement;
