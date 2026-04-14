'use client';

import { useRef, useEffect, useState } from 'react';
import { ParticleEngine } from '@/lib/effects/particle-canvas';

export function useParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<ParticleEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const eng = new ParticleEngine(canvas);
    setEngine(eng);

    const onResize = () => eng.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      eng.destroy();
      setEngine(null);
    };
  }, []);

  return { canvasRef, engine };
}
