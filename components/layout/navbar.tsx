'use client';

import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

export function Navbar() {
  const { user, login, logout, authenticated, ready } = usePrivy();
  const walletAddress = user?.wallet?.address;

  return (
    <nav className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="font-display text-2xl font-black tracking-tight"
        style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
        WHOT<span style={{ color: 'var(--gold-base)' }}>NAD</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/leaderboard"
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Leaderboard
        </Link>

        {/* Gojo's stats — always visible */}
        <Link
          href="/profile/gojo"
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
          Gojo
        </Link>

        {ready && authenticated && walletAddress ? (
          <>
            <Link
              href={`/profile/${user?.id}`}
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
                textDecoration: 'none',
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--surface-1)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
            >
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </Link>
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
          </>
        ) : ready ? (
          <button
            onClick={login}
            className="text-sm font-semibold px-4 py-2 rounded transition-colors"
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Connect
          </button>
        ) : null}

        <Link href="/lobby"
          className="text-sm font-semibold px-4 py-2 rounded transition-colors"
          style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
          Play
        </Link>
      </div>
    </nav>
  );
}
