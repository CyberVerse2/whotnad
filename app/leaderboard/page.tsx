import Link from 'next/link';
import { getCurrentSeason, getLeaderboard } from '@/lib/seasons/manager';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  let season;
  let entries: Awaited<ReturnType<typeof getLeaderboard>> = [];
  let userMap: Record<string, { walletAddress: string; displayName: string | null }> = {};

  try {
    season = await getCurrentSeason();
    entries = await getLeaderboard(season.id);

    if (entries.length > 0) {
      const userIds = entries.map((e) => e.userId);
      const userRows = await db
        .select({ id: users.id, walletAddress: users.walletAddress, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, userIds));

      for (const u of userRows) {
        userMap[u.id] = { walletAddress: u.walletAddress, displayName: u.displayName };
      }
    }
  } catch {
    // DB not available — show empty state
  }

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
            marginBottom: 32,
          }}>
            Weekly season. Resets every Monday.
          </p>
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

        {entries.length === 0 ? (
          <div className="animate-slide-up stagger-2" style={{
            background: 'var(--surface-1)',
            borderRadius: 6,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <p className="font-display" style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              NO GAMES YET
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Be the first to play this season.
            </p>
          </div>
        ) : (
          <div className="animate-slide-up stagger-2" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map((entry, i) => {
              const user = userMap[entry.userId];
              const addr = user?.walletAddress ?? '';
              const label = user?.displayName || (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown');
              const rank = i + 1;

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 80px 80px',
                    gap: 8,
                    padding: '12px 12px',
                    background: rank <= 3 ? 'var(--surface-1)' : 'transparent',
                    borderRadius: 6,
                  }}
                >
                  <span className="font-display" style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: rank === 1 ? 'var(--gold-base)' : rank <= 3 ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    {rank}
                  </span>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {addr ? (
                      <Link href={`/profile/${addr}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {label}
                      </Link>
                    ) : label}
                  </span>
                  <span className="font-display" style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                  }}>
                    {entry.totalPoints}
                  </span>
                  <span style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {entry.wins}/{entry.losses}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Badges */}
        <div className="animate-slide-up stagger-3" style={{ marginTop: 48 }}>
          <h2 className="font-display" style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}>
            SEASON BADGES
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 8,
          }}>
            <BadgeItem emoji="&#x1F3C6;" name="CHAMPION" desc="#1 on leaderboard" />
            <BadgeItem emoji="&#x26A1;" name="SPEEDSTER" desc="Highest avg speed bonus" />
            <BadgeItem emoji="&#x1F480;" name="RUTHLESS" desc="Highest avg dominance" />
            <BadgeItem emoji="&#x1F525;" name="UNSTOPPABLE" desc="Longest win streak" />
            <BadgeItem emoji="&#x1F916;" name="AGENT SLAYER" desc="Most AI wins" />
            <BadgeItem emoji="&#x1F451;" name="VETERAN" desc="5+ consecutive seasons" />
          </div>
        </div>
      </main>
    </div>
  );
}

function BadgeItem({ emoji, name, desc }: { emoji: string; name: string; desc: string }) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      borderRadius: 6,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div>
        <p className="font-display" style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '0.06em',
        }}>
          {name}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</p>
      </div>
    </div>
  );
}
