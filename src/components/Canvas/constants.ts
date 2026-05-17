import { uid } from '../../utils/uid';

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

export function getHandlePositions(b: { x: number; y: number; w: number; h: number }): Record<HandleId, [number, number]> {
  return {
    nw: [b.x, b.y],
    n: [b.x + b.w / 2, b.y],
    ne: [b.x + b.w, b.y],
    e: [b.x + b.w, b.y + b.h / 2],
    se: [b.x + b.w, b.y + b.h],
    s: [b.x + b.w / 2, b.y + b.h],
    sw: [b.x, b.y + b.h],
    w: [b.x, b.y + b.h / 2],
  };
}

/** Generate a unique element ID. Uses shared uid() utility. */
export function nextId(type: string): string {
  return uid(type);
}

export const CURSOR_MAP: Record<string, string> = {
  select: 'default',
  freedraw: 'crosshair',
  eraser: 'crosshair',
  'add-text': 'crosshair',
  'add-rect': 'crosshair',
  'add-line': 'crosshair',
  'add-circle': 'crosshair',
};
