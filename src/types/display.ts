export interface DisplayConfig {
  type: string;
  width: number;
  height: number;
}

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

export const FONT_METRICS: Record<string, { width: number; height: number }> = {
  'u8g2_font_6x10_tr': { width: 6, height: 10 },
  'u8g2_font_5x7_tr': { width: 5, height: 7 },
  'u8g2_font_7x13_tr': { width: 7, height: 13 },
  'u8g2_font_8x13_tr': { width: 8, height: 13 },
  'u8g2_font_9x15_tr': { width: 9, height: 15 },
  'u8g2_font_10x20_tr': { width: 10, height: 20 },
};

export const SNAP_PRESETS = [0, 1, 2, 4, 8, 16];
