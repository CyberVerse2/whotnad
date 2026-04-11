import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

const SHAPES = ['●', '▲', '✚', '■', '★'] as const;

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen felt-texture">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Hero */}
        <div className="text-center max-w-3xl animate-slide-up">
          {/* Floating shapes */}
          <div className="flex justify-center gap-3 mb-6"
            style={{ color: 'var(--text-muted)' }}>
            {SHAPES.map((s, i) => (
              <span key={i} className="text-xl opacity-60">{s}</span>
            ))}
          </div>

          <h1 className="font-display font-900 tracking-tight mb-6"
            style={{
              fontSize: 'clamp(3.5rem, 10vw, 7rem)',
              color: 'var(--text-primary)',
              lineHeight: 0.9,
            }}>
            PLAY WHOT
            <br />
            <span style={{ color: 'var(--gold-base)' }}>WIN MON</span>
          </h1>

          <p className="text-lg max-w-lg mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}>
            Nigeria&apos;s card game, played for real stakes on Monad.
            1v1 matches. Weekly seasons. AI opponents that play to win.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/lobby"
              className="font-display font-700 text-lg px-10 py-4 rounded transition-all"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                letterSpacing: '0.05em',
              }}>
              FIND A MATCH
            </Link>
            <Link href="#rules"
              className="text-sm font-medium px-6 py-4 transition-colors"
              style={{ color: 'var(--text-secondary)' }}>
              How to play
            </Link>
          </div>
        </div>

        {/* Stakes bar */}
        <div className="mt-20 w-full max-w-2xl animate-slide-up stagger-2">
          <div className="flex items-center justify-between px-6 py-4 rounded"
            style={{ background: 'var(--surface-2)' }}>
            <StakeStat label="ENTRY" value="1 MON" />
            <div className="w-px h-8" style={{ background: 'var(--surface-3)' }} />
            <StakeStat label="WINNER" value="1.8 MON" accent />
            <div className="w-px h-8" style={{ background: 'var(--surface-3)' }} />
            <StakeStat label="RAKE" value="10%" />
          </div>
        </div>

        {/* Rules section */}
        <section id="rules" className="mt-24 w-full max-w-2xl pb-20">
          <h2 className="font-display font-800 text-3xl mb-8 animate-slide-up stagger-3"
            style={{ color: 'var(--text-primary)' }}>
            SPECIAL CARDS
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SpecialCard number={1} name="HOLD ON" effect="Skip opponent" shape="●" delay={3} />
            <SpecialCard number={2} name="PICK TWO" effect="Opponent draws 2" shape="▲" delay={4} />
            <SpecialCard number={5} name="PICK THREE" effect="Opponent draws 3" shape="✚" delay={5} />
            <SpecialCard number={8} name="SUSPENSION" effect="Skip opponent" shape="■" delay={6} />
            <SpecialCard number={14} name="GENERAL MARKET" effect="Opponent draws 1" shape="★" delay={7} />
            <SpecialCard number={20} name="WHOT!" effect="Wild — name a shape" shape="🌟" delay={8} />
          </div>

          <p className="mt-6 text-sm leading-relaxed max-w-md"
            style={{ color: 'var(--text-muted)' }}>
            Match cards by shape or number. First to empty your hand wins.
            Last Card rule: declare with 2 cards left, or draw 2 as penalty.
          </p>
        </section>
      </main>

      <footer className="text-center py-6 text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--surface-2)' }}>
        Verifiable on Monad. Randomness by Drand. Every game on-chain.
      </footer>
    </div>
  );
}

function StakeStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className="font-display text-[10px] font-600 tracking-widest mb-1"
        style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="font-display font-800 text-xl"
        style={{ color: accent ? 'var(--gold-base)' : 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

function SpecialCard({
  number,
  name,
  effect,
  shape,
  delay,
}: {
  number: number;
  name: string;
  effect: string;
  shape: string;
  delay: number;
}) {
  return (
    <div className={`p-4 rounded transition-colors animate-slide-up stagger-${delay}`}
      style={{ background: 'var(--surface-1)' }}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-display font-900 text-2xl"
          style={{ color: 'var(--gold-base)' }}>
          {number}
        </span>
        <span className="text-sm opacity-40">{shape}</span>
      </div>
      <p className="font-display font-700 text-xs tracking-wider"
        style={{ color: 'var(--text-primary)' }}>
        {name}
      </p>
      <p className="text-xs mt-0.5"
        style={{ color: 'var(--text-muted)' }}>
        {effect}
      </p>
    </div>
  );
}
