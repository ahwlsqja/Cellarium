import { create } from 'zustand';

interface CanvasStoreState {
  // UI state
  selectedColorIndex: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  hoveredPixel: { x: number; y: number } | null;
  tool: 'paint' | 'pan';

  // Actions
  setSelectedColor: (index: number) => void;
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  setHoveredPixel: (pixel: { x: number; y: number } | null) => void;
  setTool: (tool: 'paint' | 'pan') => void;
  resetView: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  // Defaults
  selectedColorIndex: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  hoveredPixel: null,
  tool: 'paint',

  // Actions
  setSelectedColor: (index) => set({ selectedColorIndex: index }),
  setScale: (scale) => set({ scale }),
  setOffset: (x, y) => set({ offsetX: x, offsetY: y }),
  setHoveredPixel: (pixel) => set({ hoveredPixel: pixel }),
  setTool: (tool) => set({ tool }),
  resetView: () => set({ scale: 1, offsetX: 0, offsetY: 0 }),
}));
