import type {
  CanvasElement, DisplayConfig, Layer,
  FrameAnimation, Frame, ProceduralWidget, WidgetType,
  Screen, ScreenTransition, ProjectMeta,
} from '../types';

export type ActiveTool = 'select' | 'freedraw' | 'eraser' | 'add-text' | 'add-rect' | 'add-line' | 'add-circle' | 'add-bitmap';

export type SceneMode = 'static' | 'animation' | 'widgets';

export interface EditorState {
  mode: SceneMode;
  activeAnimationId: string | null;
  activeFrameId: string | null;
  onionPrev: boolean;
  onionNext: boolean;
  onionOpacity: number;
  playing: boolean;
  selectedWidgetId: string | null;
}

export interface AppState {
  display: DisplayConfig;
  layers: Layer[];
  selectedLayerId: string;
  selectedId: string | null;
  erasedPixels: [number, number][];
  showGrid: boolean;
  snapSize: number;
  zoom: number;
  activeTool: ActiveTool;
  animations: FrameAnimation[];
  widgets: ProceduralWidget[];
  editor: EditorState;
  project: ProjectMeta;
  screens: Screen[];
  activeScreenId: string;
}

export type Action =
  | { type: 'SET_DISPLAY'; payload: DisplayConfig }
  | { type: 'ADD_ELEMENT'; payload: CanvasElement }
  | { type: 'UPDATE_ELEMENT'; payload: CanvasElement }
  | { type: 'DELETE_ELEMENT'; payload: string }
  | { type: 'SELECT_ELEMENT'; payload: string | null }
  | { type: 'MOVE_ELEMENT'; payload: { id: string; x: number; y: number; x2?: number; y2?: number } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_SNAP'; payload: number }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'LOAD_PROJECT'; payload: import('../types').Project }
  | { type: 'REORDER_ELEMENT'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'DUPLICATE_ELEMENT'; payload: string }
  | { type: 'SET_TOOL'; payload: ActiveTool }
  | { type: 'ADD_PIXELS'; payload: { id: string; pixels: [number, number][] } }
  | { type: 'ERASE_PIXEL'; payload: { x: number; y: number } }
  | { type: 'CLEAR_ERASED' }
  | { type: 'TRANSFORM_ELEMENT'; payload: { id: string; op: 'flip-h' | 'flip-v' | 'rotate'; angle?: number } }
  | { type: 'RESIZE_ELEMENT'; payload: { id: string; x: number; y: number; width: number; height: number } }
  | { type: 'ADD_LAYER'; payload?: { name?: string } }
  | { type: 'DELETE_LAYER'; payload: string }
  | { type: 'RENAME_LAYER'; payload: { id: string; name: string } }
  | { type: 'TOGGLE_LAYER_VISIBLE'; payload: string }
  | { type: 'SELECT_LAYER'; payload: string }
  | { type: 'REORDER_LAYER'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'MOVE_ELEMENT_TO_LAYER'; payload: { elementId: string; layerId: string } }
  | { type: 'SET_SCENE_MODE'; payload: SceneMode }
  | { type: 'SET_ONION'; payload: Partial<Pick<EditorState, 'onionPrev' | 'onionNext' | 'onionOpacity'>> }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'ADD_ANIMATION'; payload?: { name?: string } }
  | { type: 'DELETE_ANIMATION'; payload: string }
  | { type: 'RENAME_ANIMATION'; payload: { id: string; name: string } }
  | { type: 'TOGGLE_ANIMATION_VISIBLE'; payload: string }
  | { type: 'SELECT_ANIMATION'; payload: string }
  | { type: 'UPDATE_ANIMATION'; payload: { id: string; changes: Partial<FrameAnimation> } }
  | { type: 'ADD_FRAME'; payload: { animationId: string } }
  | { type: 'DUPLICATE_FRAME'; payload: { animationId: string; frameId: string } }
  | { type: 'DELETE_FRAME'; payload: { animationId: string; frameId: string } }
  | { type: 'REORDER_FRAME'; payload: { animationId: string; frameId: string; direction: 'left' | 'right' } }
  | { type: 'SELECT_FRAME'; payload: { animationId: string; frameId: string } }
  | { type: 'UPDATE_FRAME'; payload: { animationId: string; frameId: string; changes: Partial<Frame> } }
  | { type: 'ADD_WIDGET'; payload: { widgetType: WidgetType } }
  | { type: 'UPDATE_WIDGET'; payload: ProceduralWidget }
  | { type: 'DELETE_WIDGET'; payload: string }
  | { type: 'SELECT_WIDGET'; payload: string | null }
  | { type: 'MOVE_WIDGET'; payload: { id: string; x: number; y: number } }
  | { type: 'ADD_SCREEN'; payload?: { name?: string } }
  | { type: 'DELETE_SCREEN'; payload: string }
  | { type: 'RENAME_SCREEN'; payload: { id: string; name: string } }
  | { type: 'DUPLICATE_SCREEN'; payload: string }
  | { type: 'REORDER_SCREEN'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'SELECT_SCREEN'; payload: string }
  | { type: 'SET_DEFAULT_SCREEN'; payload: string }
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'SET_SCREEN_TRANSITION'; payload: { id: string; transition: ScreenTransition } };
