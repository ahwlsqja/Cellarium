'use client';

import { useCallback, useRef, useState, MutableRefObject } from 'react';
import { useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, PixelCanvasPaintABI } from '@/config/contracts';

interface UsePaintPixelOptions {
  canvasId: number;
  width: number;
  pixelsRef: MutableRefObject<number[]>;
  onPixelUpdate: (x: number, y: number, colorIndex: number) => void;
  startCooldown: () => void;
  isOnCooldown: boolean;
}

/**
 * On-chain pixel painting with optimistic local updates.
 * - Locks painting until tx is MINED (not just wallet-signed)
 * - Starts cooldown only after on-chain confirmation
 * - Reverts optimistic update if rejected or reverted
 */
export function usePaintPixel({
  canvasId,
  width,
  pixelsRef,
  onPixelUpdate,
  startCooldown,
  isOnCooldown,
}: UsePaintPixelOptions) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isPainting, setIsPainting] = useState(false);
  const [paintError, setPaintError] = useState<string | null>(null);

  const paint = useCallback(
    async (x: number, y: number, colorIndex: number, _painterAddress: string) => {
      setPaintError(null);

      if (isOnCooldown) {
        setPaintError('Cooldown active');
        return;
      }

      if (isPainting) {
        setPaintError('Wait for transaction to confirm');
        return;
      }

      const idx = y * width + x;
      const prev = pixelsRef.current[idx];

      // Optimistic update
      pixelsRef.current[idx] = colorIndex;
      onPixelUpdate(x, y, colorIndex);

      // Lock
      setIsPainting(true);

      try {
        // Step 1: Wallet sign + submit
        console.log(`[Paint] paintPixel(${canvasId}, ${x}, ${y}, ${colorIndex})`);
        const hash = await writeContractAsync({
          address: CONTRACTS.pixelCanvas.address,
          abi: PixelCanvasPaintABI,
          functionName: 'paintPixel',
          args: [BigInt(canvasId), x, y, colorIndex],
        });
        console.log('[Paint] Tx submitted:', hash);

        // Step 2: Wait for on-chain confirmation
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'reverted') {
            throw new Error('Transaction reverted on-chain');
          }
          console.log('[Paint] Tx confirmed in block', receipt.blockNumber);
        }

        // Confirmed — start cooldown
        startCooldown();
      } catch (err: unknown) {
        // Revert optimistic update
        pixelsRef.current[idx] = prev;
        onPixelUpdate(x, y, prev);

        const message = err instanceof Error ? err.message : String(err);
        console.error('[Paint] Failed:', message);

        if (message.includes('User rejected') || message.includes('user rejected')) {
          setPaintError('Transaction rejected');
        } else if (message.includes('reverted')) {
          setPaintError('Transaction reverted on-chain');
        } else {
          setPaintError(message.slice(0, 100));
        }
      } finally {
        setIsPainting(false);
      }
    },
    [canvasId, width, pixelsRef, onPixelUpdate, startCooldown, isOnCooldown, isPainting, writeContractAsync, publicClient],
  );

  return { paint, isPainting, paintError };
}
