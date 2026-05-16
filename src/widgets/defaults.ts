import type { ProceduralWidget } from '../types';

export function makeDefaultWidget(
  type: ProceduralWidget['type'],
  id: string,
  name: string,
  x: number,
  y: number,
): ProceduralWidget {
  const base = {
    id, name, visible: true, x, y, simValue: 50,
    valueSource: 'sim' as const, variableName: '',
  };
  switch (type) {
    case 'analogClock':
      return { ...base, type, valueSource: 'time', simValue: 12 * 3600, radius: 20, min: 0, max: 86400, showTicks: true, showSecondHand: true };
    case 'digitalClock':
      return { ...base, type, valueSource: 'time', simValue: 12 * 3600, font: 'u8g2_font_7x13_tr', format: 'HH:MM:SS', min: 0, max: 86400 };
    case 'progressBar':
      return { ...base, type, width: 64, height: 10, orientation: 'horizontal', min: 0, max: 100, simValue: 60 };
    case 'meter':
      return { ...base, type, width: 64, height: 12, segments: 8, min: 0, max: 100, simValue: 60 };
    case 'gauge':
      return { ...base, type, radius: 22, sweepDeg: 240, showTicks: true, min: 0, max: 100, simValue: 60 };
    case 'battery':
      return { ...base, type, width: 24, height: 12, min: 0, max: 100, simValue: 80 };
  }
}
