/**
 * Pure coordinate conversion utilities for canvas zoom/pan/pixel selection.
 * No side effects, no 'use client' needed.
 */

/**
 * Convert mouse screen position to pixel grid coordinates.
 * Accounts for canvas element position (getBoundingClientRect), zoom scale, and pan offset.
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  canvasRect: { left: number; top: number },
  scale: number,
  offsetX: number,
  offsetY: number,
  pixelSize: number,
): { x: number; y: number } {
  const canvasX = (screenX - canvasRect.left - offsetX) / scale;
  const canvasY = (screenY - canvasRect.top - offsetY) / scale;
  return {
    x: Math.floor(canvasX / pixelSize),
    y: Math.floor(canvasY / pixelSize),
  };
}

/**
 * Convert grid coordinates back to screen position for hover highlighting.
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  pixelSize: number,
): { x: number; y: number } {
  return {
    x: gridX * pixelSize * scale + offsetX,
    y: gridY * pixelSize * scale + offsetY,
  };
}

/**
 * Clamp coordinates to valid grid bounds (0 to width-1, 0 to height-1).
 */
export function clampToGrid(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, gridWidth - 1)),
    y: Math.max(0, Math.min(y, gridHeight - 1)),
  };
}

/**
 * Check whether coordinates are within the grid bounds.
 */
export function isInBounds(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): boolean {
  return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;
}
