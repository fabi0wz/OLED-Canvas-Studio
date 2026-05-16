import type { CanvasElement, Layer, FrameAnimation, Frame, Screen } from '../types';
import type { AppState } from './types';

export function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeLayer(name: string, elements: CanvasElement[] = []): Layer {
  return { id: uid('layer'), name, visible: true, elements };
}

export function makeFrame(): Frame {
  return { id: uid('frame'), durationMs: 120, elements: [] };
}

export function makeAnimation(name: string): FrameAnimation {
  return {
    id: uid('anim'), name, visible: true, x: 0, y: 0,
    playMode: 'loop',
    frames: [makeFrame()],
  };
}

export function makeScreen(name: string): Screen {
  const layer = makeLayer('main');
  return {
    id: uid('screen'),
    name,
    transition: 'instant',
    layers: [layer],
    animations: [],
    widgets: [],
    erasedPixels: [],
  };
}

const defaultLayer = makeLayer('main');
const defaultScreen: Screen = {
  id: uid('screen'),
  name: 'Screen 1',
  transition: 'instant',
  layers: [defaultLayer],
  animations: [],
  widgets: [],
  erasedPixels: [],
};

export const initialState: AppState = {
  display: { type: 'SSD1306_128x64', width: 128, height: 64 },
  layers: defaultScreen.layers,
  selectedLayerId: defaultLayer.id,
  selectedId: null,
  selectedIds: [],
  erasedPixels: [],
  showGrid: false,
  snapSize: 0,
  zoom: 3,
  activeTool: 'select',
  animations: [],
  widgets: [],
  editor: {
    mode: 'static',
    activeAnimationId: null,
    activeFrameId: null,
    onionPrev: true,
    onionNext: false,
    onionOpacity: 0.35,
    playing: false,
    selectedWidgetId: null,
  },
  project: { name: 'My Gadget', defaultScreenId: defaultScreen.id },
  screens: [defaultScreen],
  activeScreenId: defaultScreen.id,
};
