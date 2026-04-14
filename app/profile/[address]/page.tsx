'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MatchRecord {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: string;
  turnsTaken: number | null;
  winnerPoints: number | null;
  loserPoints: number | null;
  createdAt: string;
}

export default function ProfilePage() {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whot-user-id');
    }
    return null;
  });

  useEffect(() => {
    if (!userId) return;

    async function fetchMatches() {
      try {
        const res = await fetch('/api/game/history', {
          headers: { Authorization: `Bearer ${userId}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMatches(data.matches);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, [userId]);

  if (!userId) {
    return (
      <div className="felt-texture" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      }}>
        <Link href="/lobby" style={{ color: 'var(--green-bright)', textDecoration: 'none' }}>
          Play a game to create your profile
        </Link>
      </div>
    );
  }

  const finishedMatches = matches.filter((m) => m.status === 'finished');
  const wins = finishedMatches.filter((m) => m.winnerId === userId).length;
  const losses = finishedMatches.filter((m) => m.winnerId && m.winnerId !== userId).length;
  const totalPoints = finishedMatches.reduce((sum, m) => {
    if (m.winnerId === userId) return sum + (m.winnerPoints ?? 0);
    return sum + (m.loserPoints ?? 0);
  }, 0);

  return (
    <div className="felt-texture" style={{ minHeight: '100vh' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid var(--surface-2)',
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
          color: 'var(--text-primary)', textDecoration: 'none', letterSpacing: '0.02em',
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
        </Link>
        <Link href="/lobby" style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          letterSpacing: '0.08em', background: 'var(--accent)',
          color: '#fff', padding: '8px 16px', borderRadius: 4,
          textDecoration: 'none',
        }}>
          PLAY
        </Link>
      </nav>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <div className="animate-slide-up" style={{ marginBottom: 32 }}>
          <h1 className="font-display" style={{
            fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4,
          }}>
            PROFILE
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {userId?.slice(0, 16)}
          </p>
        </div>

        <div className="animate-slide-up stagger-1" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 32,
        }}>
          <StatBox label="WINS" value={wins} color="var(--green-bright)" />
          <StatBox label="LOSSES" value={losses} color="var(--danger)" />
          <StatBox label="POINTS" value={totalPoints} color="var(--gold-base)" />
        </div>

        <div className="animate-slide-up stagger-2">
          <h2 className="font-display" style={{
            fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '0.06em', marginBottom: 12,
          }}>
            MATCH HISTORY
          </h2>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
          ) : finishedMatches.length === 0 ? (
            <div style={{
              background: 'var(--surface-1)', borderRadius: 6, padding: '32px 16px', textAlign: 'center',
            }}>
              <p className="font-display" style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                NO MATCHES YET
              </p>
              <Link href="/lobby" style={{ color: 'var(--green-bright)', fontSize: 13, textDecoration: 'none' }}>
                Play your first game
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {finishedMatches.map((match) => {
                const won = match.winnerId === userId;

                return (
                  <div key={match.id} style={{
                    background: 'var(--surface-1)', borderRadius: 6, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="font-display" style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                        color: won ? 'var(--green-bright)' : 'var(--danger)',
                        width: 32,
                      }}>
                        {won ? 'WIN' : 'LOSS'}
                      </span>
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {match.turnsTaken ?? '?'} turns
                        </p>
                        <p className="font-display" style={{
                          fontSize: 14, fontWeight: 800,
                          color: won ? 'var(--gold-base)' : 'var(--text-muted)',
                        }}>
                          +{won ? match.winnerPoints ?? 0 : match.loserPoints ?? 0} pts
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface-1)', borderRadius: 6, padding: '16px 12px', textAlign: 'center',
    }}>
      <p className="font-display" style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4,
      }}>
        {label}
      </p>
      <p className="font-display" style={{ fontSize: 24, fontWeight: 900, color }}>
        {value}
      </p>
    </div>
  );
}
