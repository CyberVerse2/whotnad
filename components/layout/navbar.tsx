'use client';

import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="font-display text-2xl font-black tracking-tight"
        style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
        WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/leaderboard"
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Leaderboard
        </Link>

        {/* Tinubu's stats — always visible */}
        <Link
          href="/profile/tinubu"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--surface-1)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
        >
          Tinubu
        </Link>

        <Link href="/lobby"
          className="text-sm font-semibold px-4 py-2 rounded transition-colors"
          style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
          Play
        </Link>
      </div>
    </nav>
  );
}
