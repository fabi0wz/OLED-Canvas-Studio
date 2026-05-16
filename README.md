# OLED Canvas Studio

**OLED Canvas Studio** is a browser-based visual editor for designing monochrome (1-bit) embedded display interfaces and generating ready-to-flash [U8g2](https://github.com/olikraus/u8g2) Arduino code — no installation or back-end required.

![Overview](docs/screenshots/01-overview.png)

---

## Table of Contents

- [OLED Canvas Studio](#oled-canvas-studio)
  - [Table of Contents](#table-of-contents)
  - [What Is It?](#what-is-it)
  - [Features](#features)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Install and run](#install-and-run)
    - [Build for production](#build-for-production)
  - [User Interface](#user-interface)
    - [Top Toolbar](#top-toolbar)
    - [Workbench Panel](#workbench-panel)
    - [Canvas](#canvas)
    - [Layers Panel](#layers-panel)
    - [Properties Panel](#properties-panel)
    - [Code Panel](#code-panel)
  - [Drawing Tools](#drawing-tools)
    - [Select (`V`)](#select-v)
    - [Text (`T`)](#text-t)
    - [Rectangle (`R`)](#rectangle-r)
    - [Circle (`C`)](#circle-c)
    - [Line (`L`)](#line-l)
    - [Freehand Draw (`D`)](#freehand-draw-d)
    - [Eraser (`E`)](#eraser-e)
    - [Import Bitmap (`I`)](#import-bitmap-i)
  - [Fonts](#fonts)
  - [Subtract (Inverted) Mode](#subtract-inverted-mode)
  - [Layers](#layers)
  - [Display Presets](#display-presets)
  - [Project Save / Load](#project-save--load)
  - [Tech Stack](#tech-stack)
  - [License](#license)

---

## What Is It?

OLED Canvas Studio solves the common pain of trying to lay out a monochrome OLED display interface by trial-and-error on a physical microcontroller. Instead, you:

1. Pick your OLED display model (SSD1306, SH1106, etc.)
2. Drag shapes, text, and freehand pixels onto a pixel-perfect canvas
3. Copy the generated U8g2 C++ code and paste it directly into your Arduino sketch

The canvas renders exactly what will appear on the real display — every pixel, every font glyph matches the U8g2 library output.

---

## Features

| Feature | Description |
|---|---|
| **8 drawing tools** | Select, Text, Rectangle, Circle, Line, Freehand draw, Eraser, Bitmap import |
| **6 pixel-accurate U8g2 fonts** | 5×7, 6×10, 7×13, 8×13, 9×15, 10×20 — rendered from official BDF files |
| **Subtract (inverted) mode** | Any shape can erase pixels instead of drawing them, for masking / cutout effects |
| **Layer system** | Multiple named layers with per-layer visibility toggle and element reordering |
| **Adjustable zoom** | 1× to 20× zoom with grid overlay option |
| **Snap-to-grid** | Optional pixel snapping at 1, 2, 4, 8, or 16 px increments |
| **Transform tools** | Flip H/V, rotate ±90°/180° for rectangles and circles |
| **Resizable panels** | All three side panels and the code panel are drag-resizable and collapsible |
| **U8g2 code generation** | One-click copy / save as `.ino` of complete Arduino sketch |
| **Project save / load** | Save project as `.json`, reload later |
| **Live data placeholders** | Use `{var}` in text to mark runtime variable positions |
| **8 display presets** | SSD1306 128×64, 128×32, 64×48, 72×40 · SH1106/SSD1309/SH1107 variants |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18

### Install and run

```bash
# Clone the repo
git clone https://github.com/fabi0wz/OLED-Canvas-Studio.git
cd OLED-Canvas-Studio

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

### Build for production

```bash
npm run build
# Output in dist/
```

---

## User Interface

### Top Toolbar

![Toolbar](docs/screenshots/02-toolbar.png)

The top bar contains:

| Element | Description |
|---|---|
| **Logo** | OLED·CANVAS STUDIO branding |
| **Tool buttons** | One button per drawing tool (keyboard shortcuts shown below each icon) |
| **XY coordinates** | Live mouse position in display pixel coordinates |

**Keyboard shortcuts:**

| Key | Tool |
|---|---|
| `V` | Select / Move |
| `T` | Text |
| `R` | Rectangle |
| `C` | Circle |
| `L` | Line |
| `D` | Freehand Draw |
| `E` | Eraser |
| `I` | Import Bitmap |

---

### Workbench Panel

![Left panel](docs/screenshots/03-left-panel.png)

The left panel has two sections:

**Workbench** — global canvas settings:
- **Display** — choose your OLED hardware model
- **View** — toggle the pixel grid overlay
- **Snap** — enable snap-to-grid (Off / 1 / 2 / 4 / 8 / 16 px)
- **Zoom** — set zoom level (1× – 20×) or use `−` / `+` buttons

**Layers** — manage layers (see [Layers](#layers) section).

---

### Canvas

![Canvas with grid](docs/screenshots/04-canvas-grid.png)

The canvas is a 1-bit pixel-accurate preview of your OLED display. It renders:
- White pixels on a black background — exactly matching the physical display
- An optional **pixel grid** overlay (toggle with the *View* button)
- An **orange dashed selection box** around the selected element
- A **status bar** at the bottom showing the display model, resolution, and current zoom level

Pan by scrolling. Zoom with `−` / `+` or the zoom dropdown.

---

### Layers Panel

The layers panel (bottom of the left sidebar) lists all layers and their elements.

- **`+ Layer`** — add a new layer
- **`●`** — toggle layer visibility (click the coloured dot)
- **Double-click** a layer name to rename it
- **`↑` / `↓`** — reorder layers
- **`✕`** — delete a layer (disabled if only one layer remains)
- Each layer shows all its elements as a clickable sub-list
- Elements show their type tag (`TEXT`, `RECT`, `CIRCLE`, etc.) and a summary (text content or coordinates)

---

### Properties Panel

The Properties panel (right side) shows editable properties for the currently selected element.

**Text element:**

![Properties — Text](docs/screenshots/06-properties-text.png)

- X, Y position
- Text content (supports `{var}` placeholders for live data)
- Font selection (6 U8g2 fonts)
- Inverted toggle (renders text dark-on-light)
- Move-to-layer, Duplicate, Delete

**Rectangle / Circle element:**

![Properties — Rect](docs/screenshots/05-properties-rect.png)

- X, Y, Width / Height (or Radius for circles)
- Stroke Width
- **Filled** checkbox
- **Subtract (Inverted)** checkbox — shape erases pixels instead of drawing them
- **Transform** — flip H/V, rotate −90° / +90° / +180°
- Move-to-layer, Duplicate, Delete, reorder Z-order

---

### Code Panel

![Code panel](docs/screenshots/07-code-panel.png)

The code panel at the bottom displays the **live-generated U8g2 Arduino sketch**. It updates in real time as you draw.

**Buttons:**
| Button | Action |
|---|---|
| **Copy** | Copy the full sketch to the clipboard |
| **.ino** | Download as `layout.ino` Arduino file |
| **Save** | Save the project state as a `.json` file |
| **Load** | Load a previously saved `.json` project |

The generated code includes:
- `#include` statements for `Arduino.h`, `U8g2lib.h`, and `Wire.h`
- The correct U8G2 display constructor for your chosen display
- One `void draw<LayerName>()` function per layer
- A `drawLayout()` orchestrator that clears the buffer, calls each layer, and sends to display
- Boilerplate `setup()` and `loop()` functions

---

## Drawing Tools

### Select (`V`)
Click to select any element. Selected elements show an orange dashed bounding box. Drag to move elements. When an element is selected, its properties appear in the right panel.

### Text (`T`)
Click anywhere on the canvas to place a text element. Edit the content and font in the Properties panel. Supports all 6 U8g2 fonts rendered pixel-accurately.

### Rectangle (`R`)
Click and drag to draw a rectangle. **Hold Shift** to constrain to a square. Set Filled or Stroke-only in the Properties panel.

### Circle (`C`)
Click and drag from the center outward. **Hold Shift** to constrain the bounding box to a square. The radius is the distance from the center to the cursor.

### Line (`L`)
Click and drag to draw a line segment. **Hold Shift** to snap the angle to 45° increments.

### Freehand Draw (`D`)
Click and drag to paint individual pixels directly onto the canvas. Creates a `pixels` element that accumulates all painted pixels.

### Eraser (`E`)
Click and drag to erase pixels. The eraser works non-destructively — erased pixels are tracked per layer and subtracted at render time.

### Import Bitmap (`I`)
Import a monochrome bitmap image onto the canvas as a `bitmap` element.

---

## Fonts

OLED Canvas Studio includes pixel-accurate glyph data for all supported U8g2 fonts, parsed from the official BDF font files:

| Label | U8g2 Font | Size |
|---|---|---|
| 5×7 | `u8g2_font_5x7_tr` | 5×7 px |
| 6×10 | `u8g2_font_6x10_tr` | 6×10 px |
| 7×13 | `u8g2_font_7x13_tr` | 7×13 px |
| 8×13 | `u8g2_font_8x13_tr` | 8×13 px |
| 9×15 | `u8g2_font_9x15_tr` | 9×15 px |
| 10×20 | `u8g2_font_10x20_tr` | 10×20 px |

Every font is rendered identically to what U8g2 draws on the physical display. The canvas preview is **not** an approximation — it uses the same glyph bitmaps.

**Live data placeholders:** Use `{variableName}` in a text element (e.g. `Temp: {temp}°C`) to mark where runtime data will appear. The placeholder is rendered as-is on the canvas and in the generated code as a comment marker.

---

## Subtract (Inverted) Mode

Any shape element (rectangle, circle, line) can be set to **Subtract** mode via the *Subtract (Inverted)* checkbox in the Properties panel. When enabled:

- The shape **erases** pixels from the display buffer instead of drawing them.
- This is useful for **cutout effects** — for example, drawing a filled rectangle and then punching a circle out of it.
- In the generated code, subtract shapes are wrapped with `u8g2.setDrawColor(0)` … `u8g2.setDrawColor(1)` to achieve the same effect on hardware.

---

## Layers

Layers let you separate elements into independently togglable groups, which is useful for:

- Turning off a background layer during layout work
- Generating partial draw functions (one per layer in the output code)
- Organising complex UIs (e.g. *background*, *widgets*, *overlay*)

Each layer generates its own `void draw<Name>()` function in the Arduino sketch. Layers are rendered in order (first layer = bottom of the stack).

---

## Display Presets

| Preset | Resolution | Controller |
|---|---|---|
| SSD1306_128x64 | 128×64 | SSD1306 |
| SSD1306_128x32 | 128×32 | SSD1306 |
| SH1106_128x64 | 128×64 | SH1106 |
| SSD1309_128x64 | 128×64 | SSD1309 |
| SSD1306_64x48 | 64×48 | SSD1306 |
| SSD1306_72x40 | 72×40 | SSD1306 |
| SH1107_128x128 | 128×128 | SH1107 |
| SH1107_64x128 | 64×128 | SH1107 |

Changing the display preset updates the canvas dimensions and the U8G2 constructor in the generated code.

---

## Project Save / Load

Projects are saved as plain `.json` files containing all layers, elements, display config, and erased pixels. Use the **Save** and **Load** buttons in the Code panel. Projects are portable and can be committed to version control alongside your Arduino sketch.

---

## Tech Stack

| Technology | Role |
|---|---|
| [React 19](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Vite](https://vitejs.dev/) | Dev server & bundler |
| Custom pixel engine | 1-bit Bresenham line/circle renderer, mid-point algorithm |
| U8g2 BDF fonts | Pixel-accurate glyph data parsed from official font files |

---

## License

ISC — see [LICENSE](LICENSE).
