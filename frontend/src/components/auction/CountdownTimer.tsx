'use client';

import { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  endTimeSeconds: number; // Unix timestamp in SECONDS from contract
  onExpire?: () => void;
}

export function CountdownTimer({ endTimeSeconds, onExpire }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);

  const handleExpire = useCallback(() => {
    if (onExpire) onExpire();
  }, [onExpire]);

  useEffect(() => {
    const tick = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const left = Math.max(0, endTimeSeconds - nowSeconds);
      setRemaining(left);
      if (left <= 0) {
        handleExpire();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTimeSeconds, handleExpire]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  if (remaining <= 0) {
    return <span className="text-error font-display text-lg">ENDED</span>;
  }

  return (
    <span className="font-mono text-text text-lg">
      {hours > 0 && `${hours}h `}
      {minutes}m {seconds}s
    </span>
  );
}
