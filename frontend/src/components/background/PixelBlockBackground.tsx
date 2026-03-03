// DO NOT import on canvas painting pages -- competes for rendering resources
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/* ============================================
   PICO-8 Palette (9 colors from user decision)
   ============================================ */
const PICO_COLORS = [
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff',
  '#ff77a8', '#ffccaa', '#7e2553', '#83769c',
];

/* ============================================
   Types
   ============================================ */
interface Block {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  color: string;
  size: number;
  alpha: number;
  phase: 'floating' | 'assembling' | 'assembled' | 'scattering';
  assembleProgress: number;
}

type CyclePhase = 'floating' | 'assembling' | 'assembled' | 'scattering';

/* ============================================
   Grid Pattern Generators
   ============================================ */
type PatternGenerator = (
  count: number,
  centerX: number,
  centerY: number,
  spacing: number,
) => { x: number; y: number }[];

const squareGrid: PatternGenerator = (count, centerX, centerY, spacing) => {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const offsetX = ((cols - 1) * spacing) / 2;
  const offsetY = ((rows - 1) * spacing) / 2;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: centerX - offsetX + col * spacing,
      y: centerY - offsetY + row * spacing,
    });
  }
  return positions;
};

const diamondPattern: PatternGenerator = (count, centerX, centerY, spacing) => {
  const positions: { x: number; y: number }[] = [];
  const radius = Math.ceil(Math.sqrt(count) / 2);
  for (let dy = -radius; dy <= radius && positions.length < count; dy++) {
    const width = radius - Math.abs(dy);
    for (let dx = -width; dx <= width && positions.length < count; dx++) {
      positions.push({
        x: centerX + dx * spacing,
        y: centerY + dy * spacing,
      });
    }
  }
  return positions;
};

const heartPattern: PatternGenerator = (count, centerX, centerY, spacing) => {
  const positions: { x: number; y: number }[] = [];
  const scale = Math.max(4, Math.ceil(Math.sqrt(count) * 0.6));
  // Heart parametric sampling
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    positions.push({
      x: centerX + (x / 16) * scale * spacing,
      y: centerY + (y / 16) * scale * spacing,
    });
  }
  return positions;
};

const horizontalLines: PatternGenerator = (count, centerX, centerY, spacing) => {
  const positions: { x: number; y: number }[] = [];
  const rows = Math.ceil(Math.sqrt(count / 3));
  const cols = Math.ceil(count / rows);
  const offsetX = ((cols - 1) * spacing) / 2;
  const offsetY = ((rows - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    positions.push({
      x: centerX - offsetX + col * spacing,
      y: centerY - offsetY + row * spacing * 2.5,
    });
  }
  return positions;
};

const PATTERNS = [squareGrid, diamondPattern, heartPattern, horizontalLines];

/* ============================================
   Utility
   ============================================ */
function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pickBlockSize(): { size: number; category: 'small' | 'medium' | 'large' } {
  const r = Math.random();
  if (r < 0.5) return { size: 6, category: 'small' };
  if (r < 0.85) return { size: 10, category: 'medium' };
  return { size: 14, category: 'large' };
}

function pickAlpha(): number {
  return Math.random() < 0.7 ? 1.0 : randomRange(0.4, 0.7);
}

/* ============================================
   Phase Timing (randomized per cycle)
   ============================================ */
function getFloatingDuration(): number {
  return randomRange(8000, 12000);
}
function getAssemblingDuration(): number {
  return randomRange(1500, 2000);
}
function getAssembledDuration(): number {
  return randomRange(2000, 3000);
}

/* ============================================
   Component
   ============================================ */
export default function PixelBlockBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blocksRef = useRef<Block[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number>(0);
  const cyclePhaseRef = useRef<CyclePhase>('floating');
  const phaseStartRef = useRef<number>(0);
  const phaseDurationRef = useRef<number>(getFloatingDuration());
  const patternIdxRef = useRef<number>(0);
  const isMobileRef = useRef<boolean>(false);
  const reducedMotion = useReducedMotion();

  /* --- Compute grid targets for current pattern --- */
  const computeTargets = useCallback((w: number, h: number, blocks: Block[]) => {
    const patternFn = PATTERNS[patternIdxRef.current % PATTERNS.length];
    const spacing = 18;
    const targets = patternFn(blocks.length, w / 2, h / 2, spacing);
    for (let i = 0; i < blocks.length; i++) {
      if (targets[i]) {
        blocks[i].targetX = targets[i].x;
        blocks[i].targetY = targets[i].y;
      }
    }
  }, []);

  /* --- Initialize blocks --- */
  const initBlocks = useCallback((w: number, h: number): Block[] => {
    const mobile = w < 768;
    isMobileRef.current = mobile;
    const count = mobile ? 60 : 150;
    const blocks: Block[] = [];
    for (let i = 0; i < count; i++) {
      const { size } = pickBlockSize();
      blocks.push({
        x: randomRange(0, w),
        y: randomRange(0, h),
        vx: randomRange(-0.3, 0.3),
        vy: randomRange(-0.3, 0.3),
        targetX: 0,
        targetY: 0,
        color: PICO_COLORS[Math.floor(Math.random() * PICO_COLORS.length)],
        size,
        alpha: pickAlpha(),
        phase: 'floating',
        assembleProgress: 0,
      });
    }
    computeTargets(w, h, blocks);
    return blocks;
  }, [computeTargets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* --- Sizing --- */
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Recheck mobile threshold and adjust block count
      const wasMobile = isMobileRef.current;
      const isMobile = w < 768;
      isMobileRef.current = isMobile;

      if (blocksRef.current.length > 0) {
        const targetCount = isMobile ? 60 : 150;
        if (wasMobile !== isMobile) {
          // Crossed threshold: reinitialize
          blocksRef.current = initBlocks(w, h);
        } else {
          // Just recompute targets for existing blocks
          computeTargets(w, h, blocksRef.current);
        }
        // Ensure block count matches (safety)
        if (blocksRef.current.length !== targetCount) {
          blocksRef.current = initBlocks(w, h);
        }
      }
    }

    resize();

    /* --- Initialize blocks --- */
    const w = window.innerWidth;
    const h = window.innerHeight;
    blocksRef.current = initBlocks(w, h);

    /* --- Reduced motion: static render --- */
    if (reducedMotion) {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);
      for (const block of blocksRef.current) {
        ctx.globalAlpha = block.alpha;
        ctx.fillStyle = block.color;
        ctx.fillRect(
          Math.round(block.targetX),
          Math.round(block.targetY),
          block.size,
          block.size,
        );
      }
      ctx.globalAlpha = 1;
      return; // No animation loop
    }

    /* --- Phase state --- */
    phaseStartRef.current = performance.now();
    cyclePhaseRef.current = 'floating';
    phaseDurationRef.current = getFloatingDuration();

    /* --- Mouse tracking --- */
    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    if (!isMobileRef.current) {
      window.addEventListener('mousemove', onMouseMove);
    }

    /* --- Visibility handling --- */
    let hidden = false;
    function onVisibility() {
      hidden = document.hidden;
      if (!hidden) {
        // Reset phase timer to avoid instant transition after long tab-away
        phaseStartRef.current = performance.now();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    /* --- Animation loop --- */
    function animate(now: number) {
      if (hidden) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const cw = window.innerWidth;
      const ch = window.innerHeight;
      const blocks = blocksRef.current;
      const elapsed = now - phaseStartRef.current;
      const currentPhase = cyclePhaseRef.current;

      /* --- Phase transitions --- */
      if (currentPhase === 'floating' && elapsed >= phaseDurationRef.current) {
        cyclePhaseRef.current = 'assembling';
        phaseStartRef.current = now;
        phaseDurationRef.current = getAssemblingDuration();
        // Pick new pattern each cycle
        patternIdxRef.current = Math.floor(Math.random() * PATTERNS.length);
        computeTargets(cw, ch, blocks);
        for (const b of blocks) {
          b.phase = 'assembling';
          // assembleProgress stores distance-based delay (outer blocks start later)
          const dx = b.x - cw / 2;
          const dy = b.y - ch / 2;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.sqrt((cw / 2) ** 2 + (ch / 2) ** 2);
          b.assembleProgress = distFromCenter / maxDist; // 0=center, 1=edge (used as delay factor)
        }
      } else if (currentPhase === 'assembling' && elapsed >= phaseDurationRef.current) {
        cyclePhaseRef.current = 'assembled';
        phaseStartRef.current = now;
        phaseDurationRef.current = getAssembledDuration();
        for (const b of blocks) {
          b.phase = 'assembled';
          b.x = b.targetX;
          b.y = b.targetY;
        }
      } else if (currentPhase === 'assembled' && elapsed >= phaseDurationRef.current) {
        cyclePhaseRef.current = 'scattering';
        phaseStartRef.current = now;
        phaseDurationRef.current = 0; // Instant
        for (const b of blocks) {
          b.phase = 'scattering';
          const angle = Math.random() * Math.PI * 2;
          const mag = randomRange(3, 6);
          b.vx = Math.cos(angle) * mag;
          b.vy = Math.sin(angle) * mag;
        }
        // Immediately transition to floating
        cyclePhaseRef.current = 'floating';
        phaseDurationRef.current = getFloatingDuration();
        for (const b of blocks) {
          b.phase = 'floating';
        }
      }

      const phase = cyclePhaseRef.current;

      /* --- Update blocks --- */
      for (const block of blocks) {
        if (phase === 'floating') {
          // Speed factor: small blocks drift faster, large blocks are stately
          const speedMult = block.size <= 6 ? 1.3 : block.size <= 10 ? 1.0 : 0.7;

          // Position update
          block.x += block.vx * speedMult;
          block.y += block.vy * speedMult;

          // Friction
          block.vx *= 0.999;
          block.vy *= 0.999;

          // Random drift (small blocks get more drift)
          const driftChance = block.size <= 6 ? 0.03 : 0.02;
          if (Math.random() < driftChance) {
            block.vx += randomRange(-0.1, 0.1);
            block.vy += randomRange(-0.1, 0.1);
          }

          // Boundary wrapping
          if (block.x < -block.size) block.x = cw;
          if (block.x > cw + block.size) block.x = -block.size;
          if (block.y < -block.size) block.y = ch;
          if (block.y > ch + block.size) block.y = -block.size;

          // Mouse interaction
          if (mouseRef.current) {
            const dx = block.x - mouseRef.current.x;
            const dy = block.y - mouseRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Repulsion radius depends on block size
            const repelRadius = block.size <= 6 ? 120 : block.size <= 10 ? 150 : 180;

            if (dist < repelRadius && dist > 1) {
              // Repulsion: inversely proportional to block size (small blocks scatter more)
              const forceMult = block.size <= 6 ? 0.7 : block.size <= 10 ? 0.5 : 0.3;
              block.vx += (dx / dist) * forceMult;
              block.vy += (dy / dist) * forceMult;
            } else if (dist > 200 && dist < 400) {
              // Weak attraction for distant blocks
              block.vx -= (dx / dist) * 0.02;
              block.vy -= (dy / dist) * 0.02;
            }
          }
        } else if (phase === 'assembling') {
          // Staggered assembly: outer blocks wait before starting to move
          // assembleProgress holds distance-based delay factor (0=center, 1=edge)
          const delayMs = block.assembleProgress * 600; // up to 600ms delay for outermost blocks
          if (elapsed < delayMs) {
            // Still waiting -- gentle drift toward center to signal intent
            const dxCenter = (cw / 2) - block.x;
            const dyCenter = (ch / 2) - block.y;
            const centerDist = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
            if (centerDist > 1) {
              block.x += (dxCenter / centerDist) * 0.3;
              block.y += (dyCenter / centerDist) * 0.3;
            }
          } else {
            // Discrete snapping toward target
            const dx = block.targetX - block.x;
            const dy = block.targetY - block.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > block.size) {
              // Move in block-sized increments
              block.x += Math.sign(dx) * Math.min(Math.abs(dx), block.size * 2);
              block.y += Math.sign(dy) * Math.min(Math.abs(dy), block.size * 2);
            } else {
              // Snap to target
              block.x = block.targetX;
              block.y = block.targetY;
            }
          }

          // Zero velocity during assembly
          block.vx = 0;
          block.vy = 0;
        } else if (phase === 'assembled') {
          // Discrete breathing effect
          const breathOffset = Math.round(Math.sin(now * 0.002) * 1.5);
          block.x = block.targetX + breathOffset;
          block.y = block.targetY;
        }
      }

      /* --- Render --- */
      ctx!.fillStyle = '#0a0a0f';
      ctx!.fillRect(0, 0, cw, ch);

      for (const block of blocks) {
        ctx!.globalAlpha = block.alpha;
        ctx!.fillStyle = block.color;
        ctx!.fillRect(
          Math.round(block.x),
          Math.round(block.y),
          block.size,
          block.size,
        );
      }
      ctx!.globalAlpha = 1;

      rafIdRef.current = requestAnimationFrame(animate);
    }

    rafIdRef.current = requestAnimationFrame(animate);

    /* --- Resize listener --- */
    window.addEventListener('resize', resize);

    /* --- Cleanup --- */
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      if (!isMobileRef.current) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
    };
  }, [reducedMotion, initBlocks, computeTargets]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
