'use client';

import { useEffect, useRef } from 'react';

interface ComboMeterProps {
  count: number;
}

export function ComboMeter({ count }: ComboMeterProps) {
  const prevCount = useRef(count);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (count > prevCount.current && elRef.current) {
      elRef.current.classList.remove('animate-combo-hit');
      // Force reflow to restart animation
      void elRef.current.offsetWidth;
      elRef.current.classList.add('animate-combo-hit');
    }
    prevCount.current = count;
  }, [count]);

  if (count === 0) return null;

  const totalDraw = count * 2;
  const intensity = Math.min(count, 5);
  const colors = [
    '#D4A017', // 1 stack
    '#E8923A', // 2 stacks
    '#E74C3C', // 3 stacks
    '#C0392B', // 4 stacks
    '#8B0000', // 5+ stacks
  ];
  const color = colors[Math.min(intensity - 1, colors.length - 1)];

  return (
    <div
      ref={elRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 700,
        color,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ fontSize: 16 }}>🔥</span>
      <span>+{totalDraw}</span>
      {count > 1 && (
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          x{count}
        </span>
      )}
    </div>
  );
}
