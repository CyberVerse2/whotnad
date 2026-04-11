'use client';

import { useState, useEffect, useCallback } from 'react';

const SHAPES = ['●', '▲', '✚', '■', '★'];

export default function SlideDeck() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const totalSlides = slides.length;

  const goTo = useCallback((index: number, dir?: 'next' | 'prev') => {
    if (index < 0 || index >= totalSlides) return;
    setDirection(dir ?? (index > current ? 'next' : 'prev'));
    setCurrent(index);
  }, [current, totalSlides]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goTo(current + 1, 'next');
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1, 'prev');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, goTo]);

  const slide = slides[current];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'var(--font-display)',
      overflow: 'hidden',
      cursor: 'none',
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(99,80,204,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,80,204,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Accent glow */}
      <div style={{
        position: 'absolute',
        top: '-30%',
        right: '-10%',
        width: '60%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(99,80,204,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Slide content */}
      <div
        key={current}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          animation: `slide-${direction === 'next' ? 'up' : 'down'} 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
        }}
      >
        {slide.content}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 40px',
        zIndex: 10,
      }}>
        {/* Logo */}
        <span style={{
          fontWeight: 900,
          fontSize: 14,
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
        }}>
          WHOTNAD
        </span>

        {/* Slide dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                background: i === current ? '#6350CC' : 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>

        {/* Slide number */}
        <span style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 600,
          letterSpacing: '0.05em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(current + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
        </span>
      </div>

      {/* Nav click zones */}
      <div
        onClick={() => goTo(current - 1, 'prev')}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 60,
          width: '15%',
          cursor: current > 0 ? 'w-resize' : 'default',
          zIndex: 5,
        }}
      />
      <div
        onClick={() => goTo(current + 1, 'next')}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 60,
          width: '15%',
          cursor: current < totalSlides - 1 ? 'e-resize' : 'default',
          zIndex: 5,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   SLIDE DEFINITIONS
   ───────────────────────────────────────────── */

const slides: { content: React.ReactNode }[] = [
  // ── 1. TITLE ──
  {
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          {SHAPES.map((s, i) => (
            <span key={i} style={{
              fontSize: 28,
              opacity: 0.4,
              animation: `fade-in 0.4s ease forwards`,
              animationDelay: `${i * 0.08}s`,
            }}>{s}</span>
          ))}
        </div>
        <h1 style={{
          fontSize: 'clamp(4rem, 12vw, 9rem)',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          lineHeight: 0.85,
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, #fff 30%, #836EF9 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          WHOTNAD
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          maxWidth: 600,
        }}>
          Nigeria&apos;s Card Game. Real Stakes. On-Chain.
        </p>
        <div style={{
          marginTop: 32,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}>
          <Badge>MONAD</Badge>
          <Badge>AI AGENT</Badge>
          <Badge>PLAY-TO-EARN</Badge>
        </div>
      </div>
    ),
  },

  // ── 2. THE OPPORTUNITY ──
  {
    content: (
      <div style={{ maxWidth: 900 }}>
        <SlideLabel>THE OPPORTUNITY</SlideLabel>
        <h2 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 900,
          lineHeight: 1.05,
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          A local culture.
          <br />
          <span style={{ color: '#836EF9' }}>A global stage.</span>
        </h2>
        <p style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 500,
          lineHeight: 1.7,
          maxWidth: 680,
          marginBottom: 40,
          textTransform: 'none',
        }}>
          Whot is Nigeria&apos;s national card game. Millions play it &mdash; at home, in hostels, on phones, for money. It is already a culture.
        </p>
        <p style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 500,
          lineHeight: 1.7,
          maxWidth: 680,
          marginBottom: 40,
          textTransform: 'none',
        }}>
          But right now, it stays local. No competitive infrastructure. No way for the game to grow beyond the table it&apos;s sitting on.
        </p>
        <div style={{
          background: 'rgba(99,80,204,0.06)',
          border: '1px solid rgba(99,80,204,0.15)',
          borderRadius: 10,
          padding: '24px 28px',
          maxWidth: 680,
        }}>
          <p style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 600,
            lineHeight: 1.6,
            textTransform: 'none',
          }}>
            Whotnad is turning the ordinary Whot game into <span style={{ color: '#836EF9', fontWeight: 800 }}>a global ecosystem</span> &mdash; where you play against AI agents, earn MON, and have fun doing it.
          </p>
        </div>
      </div>
    ),
  },

  // ── 3. THE AI AGENT + HOW IT WORKS ──
  {
    content: (
      <div style={{ maxWidth: 950 }}>
        <SlideLabel>THE AI AGENT</SlideLabel>
        <h2 style={{
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          fontWeight: 900,
          lineHeight: 1.05,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          An opponent with
          <br />
          <span style={{ color: '#836EF9' }}>skin in the game.</span>
        </h2>
        <p style={{
          fontSize: 17,
          color: 'rgba(255,255,255,0.45)',
          fontWeight: 500,
          marginBottom: 36,
          maxWidth: 560,
          lineHeight: 1.5,
          textTransform: 'none',
        }}>
          Not a bot that picks random cards. An AI that deposits real MON, reasons through every move, and plays to win.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
          <AgentFeature title="DEPOSITS REAL MON" desc="Agent puts 1 MON into escrow. If it loses, you take the money." />
          <AgentFeature title="STRATEGIC THINKING" desc="Powered by OpenAI. Evaluates hand, stacks penalties, times wilds." />
          <AgentFeature title="ZERO WAIT TIME" desc="Queue, match, play. No searching for opponents. Instant liquidity." />
          <AgentFeature title="ALWAYS-ON REVENUE" desc="Every agent match generates 0.2 MON rake. No player-count dependency." />
        </div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
          {[
            { step: '01', title: 'CONNECT', desc: 'Wallet via Privy' },
            { step: '02', title: 'QUEUE', desc: 'Matched with AI' },
            { step: '03', title: 'DEPOSIT', desc: '1 MON escrow' },
            { step: '04', title: 'PLAY', desc: 'Empty hand wins' },
            { step: '05', title: 'CLAIM', desc: 'Winner gets 1.8' },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 14px',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              animation: `fade-in 0.4s ease forwards`,
              animationDelay: `${i * 0.08}s`,
              opacity: 0,
            }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#6350CC', lineHeight: 1, marginBottom: 8 }}>{item.step}</span>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>{item.title}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'none' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── 4. MONETIZATION + ON-CHAIN ──
  {
    content: (
      <div style={{ maxWidth: 950 }}>
        <SlideLabel>MONETIZATION &amp; TRUST</SlideLabel>
        <h2 style={{
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          fontWeight: 900,
          textTransform: 'uppercase',
          marginBottom: 40,
        }}>
          10% Rake. <span style={{ color: '#836EF9' }}>Every Match.</span>
        </h2>
        <div style={{ display: 'flex', gap: 32, marginBottom: 36, flexWrap: 'wrap' }}>
          <MetricCard value="1" unit="MON" label="Entry Fee" />
          <MetricCard value="2" unit="MON" label="Total Pool" />
          <MetricCard value="1.8" unit="MON" label="Winner Payout" />
          <MetricCard value="0.2" unit="MON" label="Platform Rake" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{
            background: 'rgba(99,80,204,0.04)',
            border: '1px solid rgba(99,80,204,0.12)',
            borderRadius: 10,
            padding: '22px 24px',
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#836EF9', marginBottom: 16, textTransform: 'uppercase' }}>
              On-Chain Settlement
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Escrow via TournamentPool.sol', 'ECDSA-signed results', 'Drand beacon for deck shuffles', '2-hour refund timeout', 'State hashes on-chain'].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6350CC', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500, textTransform: 'none' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: 'rgba(99,80,204,0.04)',
            border: '1px solid rgba(99,80,204,0.12)',
            borderRadius: 10,
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#836EF9', marginBottom: 16, textTransform: 'uppercase' }}>
              Why It Works
            </h3>
            <p style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 500,
              lineHeight: 1.6,
              textTransform: 'none',
            }}>
              The AI agent ensures <span style={{ color: '#836EF9', fontWeight: 700 }}>every match generates revenue</span> regardless of player count. No cold-start problem. Revenue from day one. Weekly seasons and badges keep players coming back.
            </p>
          </div>
        </div>
      </div>
    ),
  },

  // ── 5. CLOSING ──
  {
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24 }}>
        <h2 style={{
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          fontWeight: 900,
          lineHeight: 0.9,
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, #fff 30%, #836EF9 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          PLAY WHOT.
          <br />
          WIN MON.
        </h2>
        <p style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.4)',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          maxWidth: 500,
          lineHeight: 1.5,
        }}>
          Nigeria&apos;s card game meets Monad&apos;s speed.
          <br />
          AI agents with real money on the line.
        </p>
        <div style={{
          marginTop: 24,
          display: 'flex',
          gap: 32,
          alignItems: 'center',
        }}>
          <Stat value="10%" label="Rake" />
          <Stat value="<2s" label="Match Time" />
          <Stat value="24/7" label="AI Agent" />
        </div>
        <div style={{
          marginTop: 48,
          padding: '14px 40px',
          background: '#6350CC',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          LET&apos;S TALK
        </div>
      </div>
    ),
  },
];

/* ─────────────────────────────────────────────
   REUSABLE SLIDE COMPONENTS
   ───────────────────────────────────────────── */

function SlideLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.15em',
      color: '#6350CC',
      textTransform: 'uppercase',
      marginBottom: 16,
    }}>
      {children}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.12em',
      padding: '6px 16px',
      border: '1px solid rgba(99,80,204,0.3)',
      borderRadius: 20,
      color: '#836EF9',
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

function ProblemCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      flex: '1 1 240px',
      padding: '24px 20px',
      background: 'rgba(192,57,43,0.04)',
      border: '1px solid rgba(192,57,43,0.1)',
      borderRadius: 10,
    }}>
      <span style={{ fontSize: 20, color: '#c0392b', fontWeight: 900, marginBottom: 12, display: 'block' }}>{icon}</span>
      <h3 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.05em', marginBottom: 8, textTransform: 'uppercase' }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 500, lineHeight: 1.5, textTransform: 'none' }}>{desc}</p>
    </div>
  );
}

function SolutionCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      padding: '24px 20px',
      background: 'rgba(99,80,204,0.04)',
      border: '1px solid rgba(99,80,204,0.1)',
      borderRadius: 10,
    }}>
      <span style={{
        fontSize: 18,
        fontWeight: 900,
        color: '#6350CC',
        marginBottom: 12,
        display: 'block',
      }}>{icon}</span>
      <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500, lineHeight: 1.5, textTransform: 'none' }}>{desc}</p>
    </div>
  );
}

function AgentFeature({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      padding: '20px 22px',
      background: 'rgba(99,80,204,0.04)',
      border: '1px solid rgba(99,80,204,0.08)',
      borderRadius: 8,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#836EF9', marginBottom: 8, textTransform: 'uppercase' }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 500, lineHeight: 1.4, textTransform: 'none' }}>{desc}</p>
    </div>
  );
}

function TrustPoint({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#6350CC',
        marginTop: 7,
        flexShrink: 0,
      }} />
      <div>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.05em', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'none' }}>{desc}</span>
      </div>
    </div>
  );
}

function MetricCard({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div style={{ flex: '1 1 120px', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{value}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#836EF9' }}>{unit}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'block', marginBottom: 4 }}>{value}</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'none' }}>{label}</span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, fontWeight: 900, color: '#836EF9', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginTop: 6, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
