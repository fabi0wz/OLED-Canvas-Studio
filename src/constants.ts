// ─── Editor constants ──────────────────────────────────────────────────────

/** Available zoom presets for the canvas view. */
export const ZOOM_PRESETS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

/** Default zoom level for new projects. */
export const DEFAULT_ZOOM = 3;

/** Minimum/maximum panel widths (px) for resizable sidebar panels. */
export const PANEL_LIMITS = {
  left: { min: 180, max: 420 },
  right: { min: 200, max: 420 },
  bottom: { min: 100, max: 600 },
} as const;

// ─── Clock / time defaults ─────────────────────────────────────────────────

/** Seconds representing 12:00:00 — used as default simValue for clock widgets. */
export const NOON_SECONDS = 12 * 3600;

/** Full day in seconds (used as max for time-based widgets). */
export const DAY_SECONDS = 86400;

// ─── Canvas interaction ────────────────────────────────────────────────────

/** Pixel tolerance for resize-handle hit detection. */
export const HANDLE_HIT_TOLERANCE = 6;

/** Default element size produced by a bare click (no drag). */
export const DEFAULT_RECT_SIZE = { width: 30, height: 20 };
export const DEFAULT_LINE_LENGTH = 30;
export const DEFAULT_CIRCLE_RADIUS = 10;
