'use client';

interface CooldownTimerProps {
  isOnCooldown: boolean;
  isPainting?: boolean;
  displaySeconds: number;
  remaining: number; // ms
  totalCooldownMs?: number; // total cooldown in ms for progress bar
}

/**
 * Cooldown countdown display with pixel-art stepped animations.
 * Shows three states: READY, cooldown countdown, or CONFIRMING (tx pending).
 */
export default function CooldownTimer({
  isOnCooldown,
  isPainting = false,
  displaySeconds,
  remaining,
  totalCooldownMs = 30_000,
}: CooldownTimerProps) {
  const progressPercent = isOnCooldown
    ? Math.max(0, Math.min(100, (remaining / totalCooldownMs) * 100))
    : 0;

  return (
    <div
      className="bg-surface-alt border border-grid p-3"
      style={{
        borderRadius: 0,
        boxShadow: 'var(--shadow-pixel-sm)',
      }}
    >
      {isPainting ? (
        <div
          className="text-center animate-pixel-pulse"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-warning)',
          }}
        >
          CONFIRMING...
        </div>
      ) : isOnCooldown ? (
        <>
          {/* Countdown text */}
          <div
            className="text-center animate-pixel-pulse"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              color: 'var(--color-warning)',
            }}
          >
            {displaySeconds}s
          </div>

          {/* Pixel-art progress bar */}
          <div
            className="mt-2 border border-grid"
            style={{
              borderRadius: 0,
              height: '8px',
              overflow: 'hidden',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: 'var(--color-warning)',
                transition: 'width 0.1s steps(10)',
                borderRadius: 0,
              }}
            />
          </div>
        </>
      ) : (
        <div
          className="text-center animate-pixel-blink"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-success)',
          }}
        >
          READY
        </div>
      )}
    </div>
  );
}
