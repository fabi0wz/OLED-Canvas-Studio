import type { CanvasElement } from './elements';
import type { FrameAnimation } from './animations';
import type { ProceduralWidget } from './widgets';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  elements: CanvasElement[];
}

/** Transition played when switching from one screen to another. */
export type ScreenTransition = 'instant' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'wipeLeft' | 'wipeRight' | 'fade';

export const SCREEN_TRANSITIONS: ScreenTransition[] = [
  'instant', 'slideLeft', 'slideRight', 'slideUp', 'slideDown', 'wipeLeft', 'wipeRight', 'fade',
];

/** A single navigable page in a project. Each screen is self-contained. */
export interface Screen {
  id: string;
  name: string;
  transition: ScreenTransition;
  layers: Layer[];
  animations: FrameAnimation[];
  widgets: ProceduralWidget[];
  erasedPixels: [number, number][];
}
