'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Navbar() {
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUsername(localStorage.getItem('whot-username'));
    setUserId(localStorage.getItem('whot-user-id'));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('whot-user-id');
    localStorage.removeItem('whot-username');
    window.location.href = '/lobby';
  };

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

        {/* Tinubu profile */}
        <Link
          href="/profile/tinubu"
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            textDecoration: 'none', padding: '4px 10px', borderRadius: 6,
            background: 'var(--surface-1)', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
        >
          Tinubu
        </Link>

        {username && userId ? (
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${userId}`}
              className="font-display"
              style={{
                fontSize: 12, fontWeight: 700, color: 'var(--gold-base)', letterSpacing: '0.04em',
                textDecoration: 'none', padding: '4px 10px', borderRadius: 6,
                background: 'var(--surface-1)', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
            >
              {username}
            </Link>
            <Link href="/lobby"
              className="text-sm font-semibold px-4 py-2 rounded transition-colors"
              style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
              Play
            </Link>
            <button
              onClick={handleLogout}
              style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', padding: 0,
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <Link href="/lobby"
            className="text-sm font-semibold px-4 py-2 rounded transition-colors"
            style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
            Play
          </Link>
        )}
      </div>
    </nav>
  );
}
