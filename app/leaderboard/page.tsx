'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Difficulty = 'hard' | 'nigerian';

interface LeaderboardEntry {
  rank: number;
  username: string;
  wins: number;
  losses: number;
  totalPoints: number;
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Difficulty>('hard');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?difficulty=${tab}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      })
      .catch(() => {
        setEntries([]);
        setLoading(false);
      });
  }, [tab]);

  return (
    <div className="felt-texture" style={{ minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--surface-2)',
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 20,
          color: 'var(--text-primary)',
          textDecoration: 'none',
          letterSpacing: '0.02em',
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
        </Link>
        <Link href="/lobby" style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.08em',
          background: 'var(--accent)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 4,
          textDecoration: 'none',
        }}>
          PLAY
        </Link>
      </nav>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <div className="animate-slide-up">
          <h1 className="font-display" style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 900,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            LEADERBOARD
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 14,
            marginBottom: 24,
          }}>
            Top players by wins. Prove you can beat the Jagaban.
          </p>
        </div>

        {/* Difficulty tabs */}
        <div className="animate-slide-up stagger-1" style={{
          display: 'flex',
          gap: 0,
          marginBottom: 24,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--surface-3)',
        }}>
          <button
            onClick={() => setTab('hard')}
            style={{
              flex: 1,
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.08em',
              padding: '14px 0',
              border: 'none',
              cursor: 'pointer',
              background: tab === 'hard' ? 'var(--danger)' : 'var(--surface-1)',
              color: tab === 'hard' ? '#fff' : 'var(--text-muted)',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            HARD MODE
          </button>
          <button
            onClick={() => setTab('nigerian')}
            style={{
              flex: 1,
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.08em',
              padding: '14px 0',
              border: 'none',
              cursor: 'pointer',
              background: tab === 'nigerian' ? '#9333ea' : 'var(--surface-1)',
              color: tab === 'nigerian' ? '#fff' : 'var(--text-muted)',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            NIGERIAN MODE
          </button>
        </div>

        {/* Table header */}
        <div className="animate-slide-up stagger-1" style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 80px',
          gap: 8,
          padding: '8px 12px',
          marginBottom: 4,
        }}>
          <span className="font-display" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>#</span>
          <span className="font-display" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>PLAYER</span>
          <span className="font-display" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textAlign: 'right' }}>PTS</span>
          <span className="font-display" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textAlign: 'right' }}>W/L</span>
        </div>

        {loading ? (
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: 6,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <p className="font-display" style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
            }}>
              LOADING...
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="animate-slide-up stagger-2" style={{
            background: 'var(--surface-1)',
            borderRadius: 6,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <p className="font-display" style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 8,
            }}>
              NO GAMES YET
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Be the first to win on {tab === 'nigerian' ? 'nigerian' : 'hard'} mode.
            </p>
          </div>
        ) : (
          <div className="animate-slide-up stagger-2" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map((entry) => (
              <div
                key={`${entry.username}-${entry.rank}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 80px 80px',
                  gap: 8,
                  padding: '12px 12px',
                  background: entry.rank <= 3 ? 'var(--surface-1)' : 'transparent',
                  borderRadius: 6,
                }}
              >
                <span className="font-display" style={{
                  fontSize: 14, fontWeight: 900,
                  color: entry.rank === 1 ? 'var(--gold-base)' : entry.rank <= 3 ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {entry.rank}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.username}
                </span>
                <span className="font-display" style={{
                  fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'right',
                }}>
                  {entry.totalPoints}
                </span>
                <span style={{
                  fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                }}>
                  {entry.wins}/{entry.losses}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
