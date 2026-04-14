'use client';

interface GameLogEntry {
  turn: number;
  playerId: string;
  action: { type: string; cardId?: number; chosenShape?: string };
}

interface GameLogProps {
  entries: GameLogEntry[];
  currentUserId: string;
}

export function GameLog({ entries, currentUserId }: GameLogProps) {
  const recent = entries.slice(-6);

  return (
    <div style={{
      background: 'var(--surface-1)',
      borderRadius: 6,
      padding: 12,
      maxHeight: 200,
      overflowY: 'auto',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--text-muted)',
        marginBottom: 8,
      }}>
        LOG
      </h4>
      {recent.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Waiting...
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recent.map((entry, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{
                color: entry.playerId === currentUserId ? 'var(--green-bright)' : 'var(--gold-base)',
                fontWeight: 600,
              }}>
                {entry.playerId === currentUserId ? 'You' : 'Opp'}
              </span>
              {' '}
              <span>{formatAction(entry.action)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatAction(action: GameLogEntry['action']): string {
  switch (action.type) {
    case 'play':
      return action.chosenShape ? `played (${action.chosenShape})` : 'played';
    case 'draw':
      return 'drew';
    default:
      return action.type;
  }
}
