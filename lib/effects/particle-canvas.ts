/**
 * Lightweight Canvas 2D particle engine.
 * Single rAF loop, max 200 particles, mobile-friendly.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  type: 'circle' | 'rect' | 'spark' | 'text';
  text?: string;
  gravity: number;
  friction: number;
  rotation?: number;
  rotationSpeed?: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightningBolt {
  segments: { x: number; y: number }[];
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

const MAX_PARTICLES = 200;
const LOW_END = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 2;

function scale(count: number): number {
  return LOW_END ? Math.ceil(count / 2) : count;
}

export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private lightningBolts: LightningBolt[] = [];
  private rafId: number | null = null;
  private lastTime = 0;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.loop(0);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private addParticle(p: Particle) {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  /** Particle trail along a path (card flight) */
  spawnTrail(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    count = 20
  ) {
    const n = scale(count);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const x = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 10;
      const y = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 10;
      this.addParticle({
        x, y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0, maxLife: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color, alpha: 0.8,
        type: 'spark',
        gravity: 0, friction: 0.96,
      });
    }
  }

  /** Radial burst (slam impact, shape burst) */
  spawnBurst(center: { x: number; y: number }, color: string, count = 30) {
    const n = scale(count);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 4;
      this.addParticle({
        x: center.x, y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: 0.5 + Math.random() * 0.3,
        size: 2 + Math.random() * 4,
        color, alpha: 0.9,
        type: 'circle',
        gravity: 0.5, friction: 0.95,
      });
    }
  }

  /** Expanding ring (Whot! shockwave) */
  spawnShockwave(center: { x: number; y: number }, color: string) {
    this.shockwaves.push({
      x: center.x, y: center.y,
      radius: 5, maxRadius: 150,
      color, life: 0, maxLife: 0.6,
    });
  }

  /** Gravity-affected confetti (win celebration) */
  spawnConfetti(center: { x: number; y: number }, colors: string[], count = 50) {
    const n = scale(count);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 6;
      this.addParticle({
        x: center.x + (Math.random() - 0.5) * 40,
        y: center.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 0, maxLife: 1.5 + Math.random() * 1,
        size: 4 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1,
        type: 'rect',
        gravity: 3,
        friction: 0.98,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  /** Glass shard scatter (loss card shatter) */
  spawnShatter(center: { x: number; y: number }, color: string, count = 25) {
    const n = scale(count);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.4;
      const speed = 4 + Math.random() * 8;
      this.addParticle({
        x: center.x + (Math.random() - 0.5) * 60,
        y: center.y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: 0.8 + Math.random() * 0.4,
        size: 3 + Math.random() * 6,
        color, alpha: 0.9,
        type: 'rect',
        gravity: 6,
        friction: 0.97,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  /** Jagged lightning bolt */
  spawnLightning(from: { x: number; y: number }, to: { x: number; y: number }, color = '#FFD700') {
    const segments: { x: number; y: number }[] = [{ ...from }];
    const steps = 8 + Math.floor(Math.random() * 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      segments.push({
        x: from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 40,
        y: from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 20,
      });
    }
    segments.push({ ...to });
    this.lightningBolts.push({ segments, color, life: 0, maxLife: 0.25, width: 2 });
  }

  /** Orbit particles around a point (Gojo thinking) */
  spawnOrbit(center: { x: number; y: number }, color: string, count = 8) {
    const n = scale(count);
    const radius = 20 + Math.random() * 10;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n;
      this.addParticle({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        vx: -Math.sin(angle) * 2,
        vy: Math.cos(angle) * 2,
        life: 0, maxLife: 1.5 + Math.random() * 0.5,
        size: 2 + Math.random() * 2,
        color, alpha: 0.7,
        type: 'circle',
        gravity: 0, friction: 1,
      });
    }
  }

  /** Slow drifting shape icons in background */
  spawnAmbient(bounds: { w: number; h: number }, icons: string[], colors: string[], count = 12) {
    const n = Math.min(scale(count), 15);
    for (let i = 0; i < n; i++) {
      this.addParticle({
        x: Math.random() * bounds.w,
        y: Math.random() * bounds.h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.3,
        life: 0, maxLife: 8 + Math.random() * 6,
        size: 14 + Math.random() * 10,
        color: colors[i % colors.length],
        alpha: 0.06,
        type: 'text',
        text: icons[i % icons.length],
        gravity: 0, friction: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  /** Hollow purple explosion (Gojo victory) */
  spawnHollowPurple(center: { x: number; y: number }) {
    // Core purple burst
    this.spawnBurst(center, '#8B5CF6', 40);
    // Outer blue ring
    this.spawnShockwave(center, '#6366F1');
    // Inner purple shockwave
    setTimeout(() => {
      this.spawnShockwave(center, '#A855F7');
      this.spawnBurst(center, '#C084FC', 20);
    }, 150);
  }

  clear() {
    this.particles = [];
    this.shockwaves = [];
    this.lightningBolts = [];
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  destroy() {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.clear();
  }

  private loop = (time: number) => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const dt = Math.min((time - this.lastTime) / 1000, 0.033);
    this.lastTime = time;
    if (dt === 0) return;

    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Update & draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;

      const progress = p.life / p.maxLife;
      const fadeAlpha = p.alpha * (1 - progress);

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle = p.color;

      if (p.type === 'circle' || p.type === 'spark') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.type === 'spark' ? (1 - progress * 0.5) : 1), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'rect') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation ?? 0);
        if (p.rotationSpeed) p.rotation = (p.rotation ?? 0) + p.rotationSpeed * dt;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        ctx.fill();
      } else if (p.type === 'text' && p.text) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation ?? 0);
        if (p.rotationSpeed) p.rotation = (p.rotation ?? 0) + p.rotationSpeed * dt;
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, 0, 0);
      }
      ctx.restore();
    }

    // Update & draw shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = sw.life / sw.maxLife;
      sw.radius = sw.maxRadius * progress;

      ctx.save();
      ctx.globalAlpha = 0.4 * (1 - progress);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Update & draw lightning
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life += dt;
      if (bolt.life >= bolt.maxLife) {
        this.lightningBolts.splice(i, 1);
        continue;
      }
      const progress = bolt.life / bolt.maxLife;

      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - progress);
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width * (1 - progress * 0.5);
      ctx.shadowColor = bolt.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
      for (let j = 1; j < bolt.segments.length; j++) {
        ctx.lineTo(bolt.segments[j].x, bolt.segments[j].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  };
}
