'use client';

import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

/**
 * The same celebratory confetti heyvacay.co plays on a successful booking —
 * the shared Lottie asset, loaded from /public. Fails silently so it never
 * blocks the confirmation screen.
 */
export function ConfettiAnimation({
  className,
  durationMs = 5000,
}: {
  className?: string;
  durationMs?: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/assets/animations/Confetti.json')
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (durationMs == null) return;
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  if (!visible || !data) return null;

  return (
    <div
      className={`pointer-events-none absolute z-[60] overflow-visible ${className ?? ''}`}
      style={{ top: '0', left: '0', width: '100%', height: '100%' }}
    >
      <Lottie
        animationData={data}
        loop
        autoplay
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
}
