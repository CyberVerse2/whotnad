'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/hooks/use-game';
import Link from 'next/link';

export default function LobbyPage() {
  const router = useRouter();
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

  const {
    phase,
    connected,
    matchId,
    error,
    joinQueue,
    leaveQueue,
  } = useGame(userId);

  useEffect(() => {
    if ((phase === 'matched' || phase === 'playing') && matchId) {
      router.push(`/play?matchId=${matchId}`);
    }
  }, [phase, matchId, router]);

  if (!userId) {
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
          GOJO ACCEPTED YOUR CHALLENGE
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
          1v1 card battles with points and seasons
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

      {/* Opponent profile card */}
      {phase === 'idle' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          width: '100%',
          maxWidth: 340,
        }}>
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: 12,
            padding: '28px 24px 20px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            border: '1px solid var(--surface-2)',
          }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <img
                src="/gojo.jpg"
                alt="Satoru Gojo"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--gold-base)',
                  boxShadow: '0 0 24px oklch(0.6 0.15 85 / 0.3)',
                }}
              />
              <span className="font-display" style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--gold-base)',
                letterSpacing: '0.12em',
              }}>
                YOUR OPPONENT
              </span>
              <span className="font-display" style={{
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '0.04em',
              }}>
                SATORU GOJO
              </span>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              width: '100%',
            }}>
              <div style={{
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '12px 8px',
                textAlign: 'center',
              }}>
                <p className="font-display" style={{
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                  marginBottom: 4,
                }}>
                  WINS
                </p>
                <p className="font-display" style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--green-bright)',
                }}>
                  847
                </p>
              </div>
              <div style={{
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '12px 8px',
                textAlign: 'center',
              }}>
                <p className="font-display" style={{
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                  marginBottom: 4,
                }}>
                  WIN RATE
                </p>
                <p className="font-display" style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--gold-base)',
                }}>
                  73%
                </p>
              </div>
              <div style={{
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '12px 8px',
                textAlign: 'center',
              }}>
                <p className="font-display" style={{
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                  marginBottom: 4,
                }}>
                  STREAK
                </p>
                <p className="font-display" style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--danger)',
                }}>
                  12
                </p>
              </div>
            </div>

            {/* Difficulty tag */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'oklch(0.25 0.06 25)',
              borderRadius: 20,
              padding: '6px 14px',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--danger)',
              }} />
              <span className="font-display" style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: 'var(--danger)',
              }}>
                HARD DIFFICULTY
              </span>
            </div>
          </div>

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
              width: '100%',
            }}
            onMouseEnter={(e) => connected && (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            PLAY GOJO
          </button>
        </div>
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
              GOJO IS GETTING READY...
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
    </div>
  );
}
