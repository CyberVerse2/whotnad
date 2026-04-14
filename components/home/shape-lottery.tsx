'use client';

import { useState, useEffect, useRef } from 'react';

const SHAPES = ['●', '▲', '✚', '■', '★'];
const COLORS = [
  'oklch(0.65 0.18 25)',   // red-orange
  'oklch(0.70 0.16 145)',  // green
  'oklch(0.65 0.20 260)',  // blue
  'oklch(0.72 0.18 85)',   // gold
  'oklch(0.68 0.18 310)',  // purple
];

function Reel({ slotIndex, spinning }: { slotIndex: number; spinning: boolean }) {
  const [offset, setOffset] = useState(0);
  const frameRef = useRef<number | null>(null);
  const speedRef = useRef(0);
  const offsetRef = useRef(0);

  // Each reel spins at a slightly different speed for variety
  const baseSpeed = 12 + slotIndex * 2;

  useEffect(() => {
    if (spinning) {
      speedRef.current = baseSpeed;
      const tick = () => {
        offsetRef.current += speedRef.current;
        setOffset(offsetRef.current);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } else {
      // Decelerate and snap to nearest symbol
      const decel = () => {
        speedRef.current *= 0.92;
        if (speedRef.current < 0.5) {
          // Snap to nearest whole symbol
          const symbolHeight = 32;
          const nearest = Math.round(offsetRef.current / symbolHeight) * symbolHeight;
          offsetRef.current = nearest;
          setOffset(nearest);
          return;
        }
        offsetRef.current += speedRef.current;
        setOffset(offsetRef.current);
        frameRef.current = requestAnimationFrame(decel);
      };
      frameRef.current = requestAnimationFrame(decel);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [spinning, baseSpeed]);

  const symbolHeight = 32;
  // Render enough symbols to fill the reel seamlessly
  const reelSymbols = [...SHAPES, ...SHAPES, ...SHAPES];

  return (
    <div style={{
      width: 32,
      height: symbolHeight,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(-${offset % (SHAPES.length * symbolHeight)}px)`,
        willChange: 'transform',
      }}>
        {reelSymbols.map((shape, i) => {
          const colorIndex = SHAPES.indexOf(shape);
          return (
            <div
              key={i}
              style={{
                height: symbolHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: COLORS[colorIndex],
                lineHeight: 1,
              }}
            >
              {shape}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ShapeLottery() {
  const [spinning, setSpinning] = useState(true);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // Spin for 2s, pause for 3s, repeat
    const spinDuration = 2000;
    const pauseDuration = 3000;

    const runCycle = () => {
      setSpinning(true);
      const spinTimer = setTimeout(() => {
        setSpinning(false);
        const pauseTimer = setTimeout(() => {
          setCycle((c) => c + 1);
        }, pauseDuration);
        return () => clearTimeout(pauseTimer);
      }, spinDuration);
      return () => clearTimeout(spinTimer);
    };

    const cleanup = runCycle();
    return cleanup;
  }, [cycle]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 48,
      marginBottom: 24,
    }}>
      {SHAPES.map((_, i) => (
        <Reel key={i} slotIndex={i} spinning={spinning} />
      ))}
    </div>
  );
}
