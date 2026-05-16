import type { DisplayConfig } from './display';
import type { Layer, Screen } from './scene';
import type { CanvasElement } from './elements';
import type { FrameAnimation } from './animations';
import type { ProceduralWidget } from './widgets';

export interface ProjectMeta {
  name: string;
  defaultScreenId: string;
}

export interface Project {
  display: DisplayConfig;
  /** Multi-screen project metadata. Optional for backward compatibility. */
  project?: ProjectMeta;
  /** Multi-screen project content. If present, takes precedence over the legacy single-screen fields. */
  screens?: Screen[];

  // ----- Legacy single-screen fields (still supported on load) -----
  layers?: Layer[];
  erasedPixels?: [number, number][];
  elements?: CanvasElement[];
  animations?: FrameAnimation[];
  widgets?: ProceduralWidget[];
}
