import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { matches } from '@/lib/db/schema';
import { or, like, eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function GojoProfilePage() {
  let stats = { totalGames: 0, wins: 0, losses: 0, totalPoints: 0, avgTurns: 0, winRate: 0 };
  let recentMatches: Array<{
    id: string;
    winnerId: string | null;
    turnsTaken: number | null;
    winnerPoints: number | null;
    loserPoints: number | null;
    resultTxHash: string | null;
    createdAt: Date;
    opponentId: string;
    agentId: string;
  }> = [];

  try {
    // Get all matches where an agent played
    const agentMatches = await db
      .select()
      .from(matches)
      .where(
        or(
          like(matches.player1Id, 'agent-%'),
          like(matches.player2Id, 'agent-%')
        )
      )
      .orderBy(desc(matches.createdAt))
      .limit(50);

    const finished = agentMatches.filter((m) => m.status === 'finished' && m.winnerId);

    stats.totalGames = finished.length;
    stats.wins = finished.filter((m) => m.winnerId?.startsWith('agent-')).length;
    stats.losses = stats.totalGames - stats.wins;
    stats.winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
    stats.totalPoints = finished.reduce((sum, m) => {
      if (m.winnerId?.startsWith('agent-')) return sum + (m.winnerPoints ?? 0);
      return sum + (m.loserPoints ?? 0);
    }, 0);
    stats.avgTurns = stats.totalGames > 0
      ? Math.round(finished.reduce((sum, m) => sum + (m.turnsTaken ?? 0), 0) / stats.totalGames)
      : 0;

    recentMatches = finished.slice(0, 20).map((m) => {
      const isAgent1 = m.player1Id.startsWith('agent-');
      return {
        id: m.id,
        winnerId: m.winnerId,
        turnsTaken: m.turnsTaken,
        winnerPoints: m.winnerPoints,
        loserPoints: m.loserPoints,
        resultTxHash: m.resultTxHash,
        createdAt: m.createdAt,
        opponentId: isAgent1 ? m.player2Id : m.player1Id,
        agentId: isAgent1 ? m.player1Id : m.player2Id,
      };
    });
  } catch {
    // DB unavailable
  }

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
        {/* Header */}
        <div className="animate-slide-up" style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32,
        }}>
          <Image
            src="/gojo.jpg"
            alt="Gojo"
            width={64}
            height={64}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <h1 className="font-display" style={{
              fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2,
            }}>
              GOJO
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No one could beat me - Except Gojo of course
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-slide-up stagger-1" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12,
        }}>
          <StatBox label="GAMES" value={stats.totalGames} color="var(--text-primary)" />
          <StatBox label="WINS" value={stats.wins} color="var(--success)" />
          <StatBox label="LOSSES" value={stats.losses} color="var(--danger)" />
        </div>
        <div className="animate-slide-up stagger-2" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 32,
        }}>
          <StatBox label="WIN RATE" value={`${stats.winRate}%`} color="var(--accent)" />
          <StatBox label="POINTS" value={stats.totalPoints} color="var(--gold-base)" />
          <StatBox label="AVG TURNS" value={stats.avgTurns} color="var(--text-secondary)" />
        </div>

        {/* Recent matches */}
        <div className="animate-slide-up stagger-3">
          <h2 className="font-display" style={{
            fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '0.06em', marginBottom: 12,
          }}>
            RECENT MATCHES
          </h2>

          {recentMatches.length === 0 ? (
            <div style={{
              background: 'var(--surface-1)', borderRadius: 6, padding: '32px 16px', textAlign: 'center',
            }}>
              <p className="font-display" style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                NO MATCHES YET
              </p>
              <Link href="/lobby" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>
                Challenge Gojo
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentMatches.map((match) => {
                const won = match.winnerId?.startsWith('agent-');
                return (
                  <div key={match.id} style={{
                    background: 'var(--surface-1)', borderRadius: 6, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="font-display" style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                        color: won ? 'var(--success)' : 'var(--danger)',
                        width: 32,
                      }}>
                        {won ? 'WIN' : 'LOSS'}
                      </span>
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          vs {match.opponentId.slice(0, 16)}...
                        </p>
                        <p className="font-display" style={{
                          fontSize: 14, fontWeight: 800,
                          color: won ? 'var(--gold-base)' : 'var(--text-muted)',
                        }}>
                          +{won ? match.winnerPoints ?? 0 : match.loserPoints ?? 0} pts
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {match.turnsTaken ?? '?'} turns
                    </span>
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

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
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
