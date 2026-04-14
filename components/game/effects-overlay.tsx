'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useParticleCanvas } from '@/hooks/use-particle-canvas';
import type { ParticleEngine } from '@/lib/effects/particle-canvas';

export interface EffectsOverlayHandle {
  engine: ParticleEngine | null;
  overlayEl: HTMLDivElement | null;
}

interface EffectsOverlayProps {
  overlayClassName?: string;
}

export const EffectsOverlay = forwardRef<EffectsOverlayHandle, EffectsOverlayProps>(
  function EffectsOverlay({ overlayClassName = '' }, ref) {
    const { canvasRef, engine } = useParticleCanvas();
    const overlayRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      engine,
      overlayEl: overlayRef.current,
    }), [engine]);

    return (
      <>
        <canvas
          ref={canvasRef}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 90,
          }}
        />
        <div
          ref={overlayRef}
          className={overlayClassName}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 89,
            transition: 'background-color 1s ease',
          }}
        />
      </>
    );
  }
);
