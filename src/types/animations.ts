import type { CanvasElement } from './elements';

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
