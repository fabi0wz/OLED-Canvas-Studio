/**
 * Parse BDF font files and generate TypeScript glyph data for bitmapFonts.ts
 * Run: node scripts/genFonts.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEMP = process.env.TEMP || '/tmp';

const FONTS = [
  { name: '5x7', file: '5x7.bdf', u8g2: 'u8g2_font_5x7_tr', cellWidth: 5, cellHeight: 7 },
  { name: '6x10', file: '6x10.bdf', u8g2: 'u8g2_font_6x10_tr', cellWidth: 6, cellHeight: 10 },
  { name: '7x13', file: '7x13.bdf', u8g2: 'u8g2_font_7x13_tr', cellWidth: 7, cellHeight: 13 },
  { name: '8x13', file: '8x13.bdf', u8g2: 'u8g2_font_8x13_tr', cellWidth: 8, cellHeight: 13 },
  { name: '9x15', file: '9x15.bdf', u8g2: 'u8g2_font_9x15_tr', cellWidth: 9, cellHeight: 15 },
  { name: '10x20', file: '10x20.bdf', u8g2: 'u8g2_font_10x20_tr', cellWidth: 10, cellHeight: 20 },
];

function parseBDF(filePath, cellWidth, cellHeight) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let fontAscent = 0;
  let fontDescent = 0;
  
  // Parse header
  for (const line of lines) {
    const ascentMatch = line.match(/^FONT_ASCENT\s+(\d+)/);
    if (ascentMatch) fontAscent = parseInt(ascentMatch[1]);
    const descentMatch = line.match(/^FONT_DESCENT\s+(\d+)/);
    if (descentMatch) fontDescent = parseInt(descentMatch[1]);
  }
  
  const totalHeight = fontAscent + fontDescent;
  // U8g2 baseline: in BDF, y=0 is the baseline. In our row-based grid (row 0 = top),
  // the baseline maps to row (fontAscent - 1). This is the row where letters "sit".
  const baseline = fontAscent - 1;
  
  const glyphs = {};
  let i = 0;
  
  while (i < lines.length) {
    const encMatch = lines[i].match(/^ENCODING\s+(\d+)/);
    if (encMatch) {
      const encoding = parseInt(encMatch[1]);
      if (encoding >= 32 && encoding <= 126) {
        // Find BBX
        while (i < lines.length && !lines[i].match(/^BBX/)) i++;
        const bbxParts = lines[i].split(/\s+/);
        const bw = parseInt(bbxParts[1]);
        const bh = parseInt(bbxParts[2]);
        const bxoff = parseInt(bbxParts[3]);
        const byoff = parseInt(bbxParts[4]);
        
        // Find BITMAP
        while (i < lines.length && lines[i].trim() !== 'BITMAP') i++;
        i++;
        
        // Read bitmap rows
        const bitmapRows = [];
        while (i < lines.length && lines[i].trim() !== 'ENDCHAR') {
          bitmapRows.push(lines[i].trim());
          i++;
        }
        
        // Now compose into a cellWidth x cellHeight grid
        // The BDF bitmap is bw-wide, bh-tall, placed at (bxoff, baseline - bh - byoff) from top-left
        // Actually: top of glyph bitmap = fontAscent - byoff - bh (from top of cell)
        const topRow = fontAscent - byoff - bh;
        
        const rows = new Array(cellHeight).fill(0);
        
        for (let r = 0; r < bh && r < bitmapRows.length; r++) {
          const hexVal = parseInt(bitmapRows[r], 16);
          const hexBits = bitmapRows[r].length * 4; // total bits in the hex string
          
          // The hex encodes pixels left-to-right from MSB.
          // We need to extract bw pixels starting from the MSB.
          // Then place them at column bxoff in our cell.
          
          const destRow = topRow + r;
          if (destRow < 0 || destRow >= cellHeight) continue;
          
          let rowVal = 0;
          for (let col = 0; col < bw; col++) {
            // Check if pixel at column col is set in the hex data
            const bitPos = hexBits - 1 - col; // MSB is leftmost
            if (hexVal & (1 << bitPos)) {
              // Place at column (bxoff + col) in our cell
              const destCol = bxoff + col;
              if (destCol >= 0 && destCol < cellWidth) {
                rowVal |= (1 << (cellWidth - 1 - destCol));
              }
            }
          }
          rows[destRow] |= rowVal;
        }
        
        glyphs[encoding] = rows;
      }
    }
    i++;
  }
  
  return { glyphs, baseline, width: cellWidth, height: cellHeight };
}

// Generate output
let output = `/**
 * Bitmap font data for pixel-accurate text rendering.
 * AUTO-GENERATED from BDF font files — do not edit manually.
 * Each font is a map from char code to an array of rows (top-to-bottom),
 * where each row is a bitmask of the pixels from left (MSB) to right.
 *
 * Only printable ASCII (32–126) is included.
 */

export interface BitmapFont {
  /** Character width in pixels */
  width: number;
  /** Character height in pixels (also = number of rows per glyph) */
  height: number;
  /** Baseline offset from top of the glyph bounding box */
  baseline: number;
  /** Glyph data: charCode → row bitmasks */
  glyphs: Record<number, number[]>;
}

`;

for (const font of FONTS) {
  const filePath = join(TEMP, font.file);
  console.log(`Parsing ${font.file}...`);
  
  const { glyphs, baseline, width, height } = parseBDF(filePath, font.cellWidth, font.cellHeight);
  
  console.log(`  ${Object.keys(glyphs).length} glyphs, ${width}x${height}, baseline=${baseline}`);
  
  const varName = `g${font.name.replace('x', '_')}`;
  
  output += `// ---------------------------------------------------------------------------\n`;
  output += `// ${font.u8g2}  —  ${width} px wide, ${height} px tall, baseline at row ${baseline}\n`;
  output += `// ---------------------------------------------------------------------------\n`;
  output += `const ${varName}: Record<number, number[]> = {\n`;
  
  const codes = Object.keys(glyphs).map(Number).sort((a, b) => a - b);
  for (const code of codes) {
    const rows = glyphs[code];
    const char = code >= 33 && code <= 126 ? String.fromCharCode(code) : (code === 32 ? 'space' : `${code}`);
    output += `  ${code}: [${rows.join(',')}], // ${char}\n`;
  }
  
  output += `};\n\n`;
  output += `const FONT_${font.name.replace('x', 'X')}: BitmapFont = {\n`;
  output += `  width: ${width},\n`;
  output += `  height: ${height},\n`;
  output += `  baseline: ${baseline},\n`;
  output += `  glyphs: ${varName},\n`;
  output += `};\n\n`;
}

output += `export const BITMAP_FONTS: Record<string, BitmapFont> = {\n`;
for (const font of FONTS) {
  const constName = `FONT_${font.name.replace('x', 'X')}`;
  output += `  '${font.u8g2}': ${constName},\n`;
}
output += `};\n`;

const outPath = join(process.cwd(), 'src', 'bitmapFonts.ts');
writeFileSync(outPath, output);
console.log(`\nWrote ${outPath} (${output.length} bytes)`);
