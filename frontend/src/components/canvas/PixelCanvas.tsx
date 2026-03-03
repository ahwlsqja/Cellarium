'use client';

import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  MutableRefObject,
} from 'react';
import { DB32_COLORS, EMPTY_COLOR } from '@/lib/palette';
import { screenToGrid, isInBounds } from '@/lib/canvas-math';
import { useCanvasStore } from '@/stores/canvasStore';

/** Imperative methods exposed to parent via ref */
export interface PixelCanvasHandle {
  fullRedraw: () => void;
  updatePixel: (x: number, y: number, colorIndex: number) => void;
}

interface PixelCanvasProps {
  width: number; // grid width in pixels
  height: number; // grid height in pixels
  pixelsRef: MutableRefObject<number[]>;
  selectedColorIndex: number;
  onPixelClick: (x: number, y: number) => void;
  isInteractive?: boolean;
}

const GRID_LINE_COLOR = '#222238';
const MIN_SCALE = 0.5;
const MAX_SCALE = 40;
const GRID_LINE_THRESHOLD = 4; // show grid lines when pixelSize * scale >= 4

const PixelCanvas = forwardRef<PixelCanvasHandle, PixelCanvasProps>(
  function PixelCanvas(
    { width, height, pixelsRef, selectedColorIndex, onPixelClick, isInteractive = true },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const rafRef = useRef<number>(0);
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const { scale, offsetX, offsetY, tool, setScale, setOffset, setHoveredPixel } =
      useCanvasStore();

    // Calculate base pixel size from container size
    const getPixelSize = useCallback(() => {
      const container = containerRef.current;
      if (!container) return 8;
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      return Math.max(1, Math.min(Math.floor(containerW / width), Math.floor(containerH / height)));
    }, [width, height]);

    // ---- Drawing functions ----

    const drawPixelAt = useCallback(
      (ctx: CanvasRenderingContext2D, x: number, y: number, colorIndex: number, pixelSize: number) => {
        const color = colorIndex === 0 ? EMPTY_COLOR : DB32_COLORS[colorIndex] ?? EMPTY_COLOR;
        ctx.fillStyle = color;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      },
      [],
    );

    const drawGridLines = useCallback(
      (ctx: CanvasRenderingContext2D, pixelSize: number) => {
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= width; x++) {
          ctx.beginPath();
          ctx.moveTo(x * pixelSize, 0);
          ctx.lineTo(x * pixelSize, height * pixelSize);
          ctx.stroke();
        }
        for (let y = 0; y <= height; y++) {
          ctx.beginPath();
          ctx.moveTo(0, y * pixelSize);
          ctx.lineTo(width * pixelSize, y * pixelSize);
          ctx.stroke();
        }
      },
      [width, height],
    );

    const drawHoverPreview = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        gx: number,
        gy: number,
        pixelSize: number,
      ) => {
        const color = DB32_COLORS[selectedColorIndex] ?? EMPTY_COLOR;
        // Semi-transparent fill
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(gx * pixelSize, gy * pixelSize, pixelSize, pixelSize);
        ctx.globalAlpha = 1;
        // Border highlight
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx * pixelSize + 0.5, gy * pixelSize + 0.5, pixelSize - 1, pixelSize - 1);
      },
      [selectedColorIndex],
    );

    const fullRedraw = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const pixelSize = getPixelSize();

      // Size canvas element to container
      const container = containerRef.current;
      if (!container) return;
      const displayW = container.clientWidth;
      const displayH = container.clientHeight;

      canvas.width = displayW * dpr;
      canvas.height = displayH * dpr;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Clear with dark background (canvas area outside the pixel grid)
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, displayW, displayH);

      // Center the pixel grid within the container
      const gridW = width * pixelSize * scale;
      const gridH = height * pixelSize * scale;
      const centerX = (displayW - gridW) / 2;
      const centerY = (displayH - gridH) / 2;

      // Apply centering + zoom/pan transform
      ctx.save();
      ctx.translate(centerX + offsetX, centerY + offsetY);
      ctx.scale(scale, scale);

      // Draw all pixels
      const pixels = pixelsRef.current;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const colorIndex = pixels[y * width + x] ?? 0;
          drawPixelAt(ctx, x, y, colorIndex, pixelSize);
        }
      }

      // Grid lines when zoomed in enough
      if (pixelSize * scale >= GRID_LINE_THRESHOLD) {
        drawGridLines(ctx, pixelSize);
      }

      // Hover preview
      const hp = useCanvasStore.getState().hoveredPixel;
      if (hp && isInBounds(hp.x, hp.y, width, height)) {
        drawHoverPreview(ctx, hp.x, hp.y, pixelSize);
      }

      ctx.restore();
    }, [
      width,
      height,
      pixelsRef,
      scale,
      offsetX,
      offsetY,
      getPixelSize,
      drawPixelAt,
      drawGridLines,
      drawHoverPreview,
    ]);

    const updatePixel = useCallback(
      (x: number, y: number, colorIndex: number) => {
        // Incremental update via full redraw (zoom/pan transforms make single-pixel draw complex)
        // TODO: optimize to draw single pixel when not zoomed/panned
        void x; void y; void colorIndex;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(fullRedraw);
      },
      [fullRedraw],
    );

    // ---- Expose imperative handle ----
    useImperativeHandle(
      ref,
      () => ({
        fullRedraw,
        updatePixel,
      }),
      [fullRedraw, updatePixel],
    );

    // ---- Setup canvas context ----
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      ctxRef.current = canvas.getContext('2d', { alpha: false });
    }, []);

    // ---- Redraw on zoom/pan/size change ----
    useEffect(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(fullRedraw);
      return () => cancelAnimationFrame(rafRef.current);
    }, [fullRedraw]);

    // ---- Resize observer ----
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(fullRedraw);
      });
      observer.observe(container);
      return () => observer.disconnect();
    }, [fullRedraw]);

    // ---- Mouse event handlers ----

    const getGridCoords = useCallback(
      (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return null;
        const rect = canvas.getBoundingClientRect();
        const pixelSize = getPixelSize();
        const { scale: s, offsetX: ox, offsetY: oy } = useCanvasStore.getState();
        // Account for centering offset
        const gridW = width * pixelSize * s;
        const gridH = height * pixelSize * s;
        const centerX = (container.clientWidth - gridW) / 2;
        const centerY = (container.clientHeight - gridH) / 2;
        return screenToGrid(e.clientX, e.clientY, rect, s, ox + centerX, oy + centerY, pixelSize);
      },
      [getPixelSize, width, height],
    );

    // Wheel zoom — must be added via addEventListener with { passive: false }
    // to allow preventDefault() (React onWheel is passive by default in Chrome)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const { scale: oldScale, offsetX: ox, offsetY: oy } = useCanvasStore.getState();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * zoomFactor));

        const newOffsetX = mouseX - (mouseX - ox) * (newScale / oldScale);
        const newOffsetY = mouseY - (mouseY - oy) * (newScale / oldScale);

        setScale(newScale);
        setOffset(newOffsetX, newOffsetY);
      };

      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }, [setScale, setOffset]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!isInteractive) return;

        const currentTool = useCanvasStore.getState().tool;

        // Middle button or pan tool: start pan
        if (e.button === 1 || (e.button === 0 && currentTool === 'pan')) {
          e.preventDefault();
          isPanningRef.current = true;
          panStartRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Left button + paint tool: click pixel
        if (e.button === 0 && currentTool === 'paint') {
          const grid = getGridCoords(e);
          if (grid && isInBounds(grid.x, grid.y, width, height)) {
            onPixelClick(grid.x, grid.y);
          }
        }
      },
      [isInteractive, width, height, getGridCoords, onPixelClick],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        // Pan
        if (isPanningRef.current) {
          const { offsetX: ox, offsetY: oy } = useCanvasStore.getState();
          const dx = e.clientX - panStartRef.current.x;
          const dy = e.clientY - panStartRef.current.y;
          setOffset(ox + dx, oy + dy);
          panStartRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Hover preview
        if (!isInteractive) return;
        const grid = getGridCoords(e);
        if (grid && isInBounds(grid.x, grid.y, width, height)) {
          const hp = useCanvasStore.getState().hoveredPixel;
          if (!hp || hp.x !== grid.x || hp.y !== grid.y) {
            setHoveredPixel(grid);
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(fullRedraw);
          }
        } else {
          if (useCanvasStore.getState().hoveredPixel !== null) {
            setHoveredPixel(null);
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(fullRedraw);
          }
        }
      },
      [isInteractive, width, height, getGridCoords, setOffset, setHoveredPixel, fullRedraw],
    );

    const handleMouseUp = useCallback(() => {
      isPanningRef.current = false;
    }, []);

    const handleMouseLeave = useCallback(() => {
      isPanningRef.current = false;
      if (useCanvasStore.getState().hoveredPixel !== null) {
        setHoveredPixel(null);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(fullRedraw);
      }
    }, [setHoveredPixel, fullRedraw]);

    const cursorStyle = isPanningRef.current
      ? 'grabbing'
      : tool === 'pan'
        ? 'grab'
        : 'crosshair';

    return (
      <div
        ref={containerRef}
        className="canvas-area relative w-full h-full border border-grid overflow-hidden select-none"
        style={{ cursor: cursorStyle }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
          className="block w-full h-full"
        />
      </div>
    );
  },
);

export default PixelCanvas;
