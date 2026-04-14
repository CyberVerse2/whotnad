'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame } from '@/hooks/use-game';
import { Board } from '@/components/game/board';
import { useParticleCanvas } from '@/hooks/use-particle-canvas';
import { soundShatter } from '@/lib/sounds';
import Link from 'next/link';

export default function PlayPage() {
  return (
    <Suspense fallback={<PlayPageLoading label="LOADING MATCH..." />}>
      <PlayPageContent />
    </Suspense>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // For now, use a simple user ID from URL or generate one
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('whot-user-id');
      if (stored) return stored;
      const id = `user-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem('whot-user-id', id);
      return id;
    }
    return null;
  });
  const matchIdFromUrl = searchParams.get('matchId');

  const {
    phase,
    gameState,
    winner,
    points,
    error,
    connected,
    log,
    forfeiting,
    lastAgentThinkMs,
    lastAgentThought,
    playCard,
    drawCard,
    forfeit,
    resetGame,
  } = useGame(userId, matchIdFromUrl);

  const handleLeave = useCallback(() => {
    resetGame();
    router.push('/lobby');
  }, [resetGame, router]);

  if (!userId) {
    return <PlayPageLoading label="LOADING..." />;
  }

  if (!connected) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 10,
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRight: '2px solid var(--gold-base)',
          borderBottom: '2px solid var(--gold-base)',
          borderLeft: '2px solid var(--gold-base)',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
        }} className="animate-spin" />
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Connecting...
        </span>
      </div>
    );
  }

  // Game over
  if (phase === 'finished' && gameState && points) {
    const isWinner = winner === userId;
    return (
      <WinLoseScreen isWinner={isWinner} points={points} resetGame={resetGame} />
    );
  }

  // Waiting for game
  if (!gameState) {
    return <PlayPageLoading label="STARTING..." spinnerColor="var(--green-bright)" />;
  }

  // Active game
  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: 'var(--danger)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}
      <Board
        gameState={gameState}
        userId={userId}
        onPlayCard={playCard}
        onDraw={drawCard}
        onLeave={handleLeave}
        onForfeit={forfeit}
        forfeiting={forfeiting}
        lastAgentThinkMs={lastAgentThinkMs}
        lastAgentThought={lastAgentThought}
        log={log}
      />
    </>
  );
}

function PlayPageLoading({
  label,
  spinnerColor = 'var(--text-muted)',
}: {
  label: string;
  spinnerColor?: string;
}) {
  return (
    <div className="felt-texture" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 10,
    }}>
      <div style={{
        width: 14,
        height: 14,
        borderRight: `2px solid ${spinnerColor}`,
        borderBottom: `2px solid ${spinnerColor}`,
        borderLeft: `2px solid ${spinnerColor}`,
        borderTop: '2px solid transparent',
        borderRadius: '50%',
      }} className="animate-spin" />
      <span className="font-display" style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
      }}>
        {label}
      </span>
    </div>
  );
}

function WinLoseScreen({
  isWinner,
  points,
  resetGame,
}: {
  isWinner: boolean;
  points: { basePoints: number; loserPoints: number; dominanceBonus: number; speedBonus: number; streakMultiplier: number; winnerPoints: number };
  resetGame: () => void;
}) {
  const { canvasRef, engine } = useParticleCanvas();

  useEffect(() => {
    if (!engine) return;
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    if (isWinner) {
      const colors = ['#D4A017', '#E8B930', '#22B88D', '#4DA6E8', '#B47AE8'];
      engine.spawnConfetti(center, colors, 50);
      const t1 = setTimeout(() => engine.spawnConfetti({ ...center, y: center.y - 50 }, colors, 40), 500);
      const t2 = setTimeout(() => engine.spawnConfetti({ ...center, y: center.y + 50 }, colors, 30), 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      soundShatter();
      engine.spawnShatter(center, '#E74C3C', 30);
      const t1 = setTimeout(() => engine.spawnHollowPurple(center), 400);
      return () => clearTimeout(t1);
    }
  }, [engine, isWinner]);

  return (
    <div className="felt-texture" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 24,
      position: 'relative',
    }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 90 }}
      />
      {!isWinner && (
        <div className="animate-screen-crack" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 89 }} />
      )}

      <h1 className={`font-display ${isWinner ? 'animate-win' : 'animate-slide-up'}`} style={{
        fontSize: 'clamp(3rem, 10vw, 5rem)',
        fontWeight: 900,
        color: isWinner ? 'var(--gold-base)' : 'var(--danger)',
        lineHeight: 0.9,
        zIndex: 91,
      }}>
        {isWinner ? 'YOU WIN' : 'YOU LOSE'}
      </h1>

      <div className="kente-divider animate-slide-up stagger-1" style={{ width: 120, zIndex: 91 }} />
      <div className="animate-slide-up stagger-2" style={{
        background: 'var(--surface-1)',
        borderRadius: 6,
        padding: 24,
        minWidth: 260,
        border: '1px solid rgba(255,255,255,0.06)',
        zIndex: 91,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PointRow label="BASE" value={isWinner ? points.basePoints : points.loserPoints} />
          {isWinner && (
            <>
              <PointRow label="DOMINANCE" value={points.dominanceBonus} color="var(--gold-base)" prefix="+" />
              <PointRow label="SPEED" value={points.speedBonus} color="var(--green-bright)" prefix="+" />
              {points.streakMultiplier > 1 && (
                <PointRow label="STREAK" value={`${points.streakMultiplier}x`} color="var(--gold-bright)" />
              )}
              <div style={{
                borderTop: '1px solid var(--surface-3)',
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}>
                <span className="font-display" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>TOTAL</span>
                <span className="font-display" style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold-base)' }}>{points.winnerPoints}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="animate-slide-up stagger-4" style={{ display: 'flex', gap: 12, zIndex: 91 }}>
        <Link href="/lobby" onClick={resetGame} style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em',
          background: 'var(--accent)', color: 'var(--surface-0)', padding: '12px 24px', borderRadius: 6, textDecoration: 'none',
        }}>
          PLAY AGAIN
        </Link>
        <Link href="/leaderboard" style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
          background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '12px 24px', borderRadius: 6, textDecoration: 'none',
        }}>
          LEADERBOARD
        </Link>
      </div>
    </div>
  );
}

function PointRow({
  label,
  value,
  color,
  prefix,
}: {
  label: string;
  value: number | string;
  color?: string;
  prefix?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    }}>
      <span className="font-display" style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: 'var(--text-muted)',
      }}>
        {label}
      </span>
      <span className="font-display" style={{
        fontSize: 18,
        fontWeight: 800,
        color: color ?? 'var(--text-primary)',
      }}>
        {prefix}{value}
      </span>
    </div>
  );
}
