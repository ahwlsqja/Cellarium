'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Cooldown timer hook using Date.now() comparison (NOT decrementing counter).
 * Precise to 100ms, drift-free.
 */
export function useCooldown(cooldownSeconds: number) {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const startCooldown = useCallback(() => {
    setEndTime(Date.now() + cooldownSeconds * 1000);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (endTime === null) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left <= 0) {
        setEndTime(null);
      }
    };

    tick(); // immediate first check
    const id = setInterval(tick, 100); // 100ms precision
    return () => clearInterval(id);
  }, [endTime]);

  return {
    remaining, // milliseconds remaining
    isOnCooldown: remaining > 0,
    displaySeconds: Math.ceil(remaining / 1000),
    startCooldown,
  };
}
