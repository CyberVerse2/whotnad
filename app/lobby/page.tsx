'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useGame } from '@/hooks/use-game';
import Link from 'next/link';

export default function LobbyPage() {
  const { user, login, logout, authenticated, ready } = usePrivy();
  const router = useRouter();
  const userId = user?.id ?? null;

  const {
    phase,
    connected,
    matchId,
    error,
    joinQueue,
    leaveQueue,
  } = useGame(authenticated ? userId : null);

  useEffect(() => {
    if ((phase === 'matched' || phase === 'playing') && matchId) {
      router.push(`/play?matchId=${matchId}`);
    }
  }, [phase, matchId, router]);

  if (!ready) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
        }}>
          LOADING...
        </span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 24,
      }}>
        <h1 className="font-display" style={{
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          fontWeight: 900,
          color: 'var(--text-primary)',
          lineHeight: 0.9,
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Connect your wallet to play
        </p>
        <button
          onClick={login}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.08em',
            background: 'var(--accent)',
            color: '#fff',
            padding: '14px 32px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.15s',
          }}
        >
          CONNECT WALLET
        </button>
      </div>
    );
  }

  if (phase === 'matched' || phase === 'playing') {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 10,
      }}>
        <div className="animate-spin" style={{
          width: 14, height: 14,
          borderRight: '2px solid var(--gold-base)',
          borderBottom: '2px solid var(--gold-base)',
          borderLeft: '2px solid var(--gold-base)',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
        }} />
        <span className="font-display" style={{
          fontSize: 14, fontWeight: 700, color: 'var(--gold-base)', letterSpacing: '0.08em',
        }}>
          MATCH FOUND
        </span>
      </div>
    );
  }

  return (
    <div className="felt-texture" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 32,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 className="font-display" style={{
          fontSize: 'clamp(2.5rem, 7vw, 4rem)',
          fontWeight: 900,
          color: 'var(--text-primary)',
          lineHeight: 0.9,
          marginBottom: 8,
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          1v1 for MON on Monad
        </p>
      </div>

      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: connected ? 'var(--green-bright)' : 'var(--danger)',
        }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
        }}>
          {connected ? 'ONLINE' : 'CONNECTING'}
        </span>
      </div>

      {error && (
        <div style={{
          background: 'oklch(0.30 0.08 25)',
          border: '1px solid var(--danger)',
          color: 'oklch(0.85 0.06 25)',
          padding: '8px 16px',
          borderRadius: 6,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      {phase === 'idle' && (
        <button
          onClick={joinQueue}
          disabled={!connected}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: '0.06em',
            background: connected ? 'var(--accent)' : 'var(--surface-3)',
            color: connected ? '#fff' : 'var(--text-muted)',
            padding: '20px 48px',
            borderRadius: 6,
            border: 'none',
            cursor: connected ? 'pointer' : 'not-allowed',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => connected && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          FIND MATCH
        </button>
      )}

      {phase === 'queued' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}>
            <div className="animate-spin" style={{
              width: 16,
              height: 16,
              borderRight: '2px solid var(--gold-base)',
              borderBottom: '2px solid var(--gold-base)',
              borderLeft: '2px solid var(--gold-base)',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
                }} />
            <span className="font-display" style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.05em',
            }}>
              SEARCHING...
            </span>
          </div>
          <button
            onClick={leaveQueue}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <Link href="/leaderboard" style={{
          color: 'var(--text-secondary)',
          fontSize: 13,
          textDecoration: 'none',
          transition: 'color 0.15s',
        }}>
          Leaderboard
        </Link>
      </div>

      {/* Wallet + Disconnect */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
        }}>
          {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
        </p>
        <button
          onClick={logout}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: 'var(--danger)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          DISCONNECT
        </button>
      </div>

    </div>
  );
}
