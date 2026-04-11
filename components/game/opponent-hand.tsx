'use client';

import { CardBack } from './card';

interface OpponentHandProps {
  cardCount: number;
}

export function OpponentHand({ cardCount }: OpponentHandProps) {
  const visibleCount = Math.min(cardCount, 10);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 16px',
      gap: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {Array.from({ length: visibleCount }).map((_, i) => (
          <div
            key={i}
            style={{
              marginLeft: i > 0 ? -20 : 0,
              zIndex: i,
            }}
          >
            <CardBack size="sm" />
          </div>
        ))}
      </div>
      <span style={{
        marginLeft: 12,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 13,
        color: 'var(--text-muted)',
        letterSpacing: '0.05em',
      }}>
        {cardCount}
      </span>
    </div>
  );
}
