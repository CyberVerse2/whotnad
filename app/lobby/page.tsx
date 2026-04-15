'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/hooks/use-game';
import Link from 'next/link';

export default function LobbyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'hard' | 'impossible'>('hard');

  // Check for existing session on mount
  useEffect(() => {
    const storedId = localStorage.getItem('whot-user-id');
    const storedName = localStorage.getItem('whot-username');
    if (storedId && storedName) {
      setUserId(storedId);
      setUsername(storedName);
    }
    setLoading(false);
  }, []);

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

  if (loading) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <span className="font-display" style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em',
        }}>
          LOADING...
        </span>
      </div>
    );
  }

  // No user — show signup form
  if (!userId || !username) {
    return (
      <SignupScreen onSignup={(id, name) => {
        setUserId(id);
        setUsername(name);
      }} />
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
          TINUBU ACCEPTED YOUR CHALLENGE
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
          Playing as <span style={{ color: 'var(--gold-base)', fontWeight: 700 }}>{username}</span>
        </p>
      </div>

      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? 'var(--green-bright)' : 'var(--danger)',
        }} />
        <span className="font-display" style={{
          fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em',
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <img
                src="/tinubu.jpg"
                alt="Tinubu"
                style={{
                  width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                  border: '3px solid var(--gold-base)',
                  boxShadow: '0 0 24px oklch(0.6 0.15 85 / 0.3)',
                }}
              />
              <span className="font-display" style={{
                fontSize: 10, fontWeight: 700, color: 'var(--gold-base)', letterSpacing: '0.12em',
              }}>
                YOUR OPPONENT
              </span>
              <span className="font-display" style={{
                fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.04em',
              }}>
                BOLA TINUBU
              </span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%',
            }}>
              <StatBox label="WINS" value="847" color="var(--green-bright)" />
              <StatBox label="WIN RATE" value="73%" color="var(--gold-base)" />
              <StatBox label="STREAK" value="12" color="var(--danger)" />
            </div>

            {/* Difficulty selector */}
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <DifficultyButton
                label="HARD"
                description="6-layer AI brain"
                active={selectedDifficulty === 'hard'}
                color="var(--danger)"
                onClick={() => setSelectedDifficulty('hard')}
              />
              <DifficultyButton
                label="IMPOSSIBLE"
                description="He sees your cards"
                active={selectedDifficulty === 'impossible'}
                color="#9333ea"
                onClick={() => setSelectedDifficulty('impossible')}
              />
            </div>
          </div>

          <button
            onClick={() => joinQueue(selectedDifficulty)}
            disabled={!connected}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900, fontSize: 20, letterSpacing: '0.06em',
              background: connected ? (selectedDifficulty === 'impossible' ? '#9333ea' : 'var(--accent)') : 'var(--surface-3)',
              color: connected ? '#fff' : 'var(--text-muted)',
              padding: '20px 48px', borderRadius: 6, border: 'none',
              cursor: connected ? 'pointer' : 'not-allowed',
              transition: 'transform 0.15s, background 0.2s', width: '100%',
            }}
            onMouseEnter={(e) => connected && (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {selectedDifficulty === 'impossible' ? 'ENTER THE ARENA' : 'CHALLENGE TINUBU'}
          </button>
        </div>
      )}

      {phase === 'queued' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div className="animate-spin" style={{
              width: 16, height: 16,
              borderRight: '2px solid var(--gold-base)',
              borderBottom: '2px solid var(--gold-base)',
              borderLeft: '2px solid var(--gold-base)',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
            }} />
            <span className="font-display" style={{
              fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em',
            }}>
              TINUBU IS GETTING READY...
            </span>
          </div>
          <button
            onClick={leaveQueue}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <Link href="/leaderboard" style={{
          color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none',
        }}>
          Leaderboard
        </Link>
      </div>
    </div>
  );
}

// ── Signup Screen ──

function SignupScreen({ onSignup }: { onSignup: (userId: string, username: string) => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Signup failed');
        setSubmitting(false);
        return;
      }

      localStorage.setItem('whot-user-id', data.userId);
      localStorage.setItem('whot-username', data.username);
      onSignup(data.userId, data.username);
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  }, [input, onSignup]);

  return (
    <div className="felt-texture" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 32,
      padding: '0 24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="font-display" style={{
          fontSize: 'clamp(2.5rem, 7vw, 4rem)',
          fontWeight: 900,
          color: 'var(--text-primary)',
          lineHeight: 0.9,
          marginBottom: 12,
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
        </h1>
        <p className="font-display" style={{
          color: 'var(--text-secondary)',
          fontSize: 14,
          letterSpacing: '0.03em',
        }}>
          Choose your name before entering the arena
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        maxWidth: 320,
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter username"
          maxLength={16}
          autoFocus
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            background: 'var(--surface-1)',
            border: `2px solid ${error ? 'var(--danger)' : 'var(--surface-3)'}`,
            borderRadius: 8,
            padding: '16px 20px',
            width: '100%',
            textAlign: 'center',
            letterSpacing: '0.04em',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => !error && (e.currentTarget.style.borderColor = 'var(--gold-base)')}
          onBlur={(e) => !error && (e.currentTarget.style.borderColor = 'var(--surface-3)')}
        />

        {error && (
          <p style={{
            color: 'var(--danger)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}>
            {error}
          </p>
        )}

        <p style={{
          color: 'var(--text-muted)',
          fontSize: 11,
          letterSpacing: '0.02em',
        }}>
          3-16 characters. Letters, numbers, underscores.
        </p>

        <button
          type="submit"
          disabled={submitting || input.trim().length < 3}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '0.06em',
            background: input.trim().length >= 3 ? 'var(--accent)' : 'var(--surface-3)',
            color: input.trim().length >= 3 ? '#fff' : 'var(--text-muted)',
            padding: '18px 48px',
            borderRadius: 6,
            border: 'none',
            cursor: input.trim().length >= 3 ? 'pointer' : 'not-allowed',
            transition: 'transform 0.15s, background 0.2s',
            width: '100%',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'CREATING...' : 'ENTER THE ARENA'}
        </button>
      </form>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: 8, padding: '12px 8px', textAlign: 'center',
    }}>
      <p className="font-display" style={{
        fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4,
      }}>
        {label}
      </p>
      <p className="font-display" style={{ fontSize: 22, fontWeight: 900, color }}>
        {value}
      </p>
    </div>
  );
}

function DifficultyButton({
  label,
  description,
  active,
  color,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? `${color}18` : 'var(--surface-2)',
        border: `2px solid ${active ? color : 'transparent'}`,
        borderRadius: 8,
        padding: '10px 8px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <p className="font-display" style={{
        fontSize: 11, fontWeight: 900, letterSpacing: '0.1em',
        color: active ? color : 'var(--text-muted)',
        marginBottom: 2,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.02em',
      }}>
        {description}
      </p>
    </button>
  );
}
