'use client';

import type { Card as CardType, Shape } from '@/types/game';
import { Card, CardBack, SHAPE_STYLES } from './card';

interface DeckPileProps {
  topCard: CardType;
  deckSize: number;
  activeShape: Shape | null;
  pendingDraws: number;
  onDraw: () => void;
  canDraw: boolean;
}

export function DeckPile({
  topCard,
  deckSize,
  activeShape,
  pendingDraws,
  onDraw,
  canDraw,
}: DeckPileProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
    }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={onDraw}
          disabled={!canDraw}
          style={{
            cursor: canDraw ? 'pointer' : 'default',
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          <CardBack size="lg" />
        </button>
        {pendingDraws > 0 && (
          <div style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: 'var(--danger)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 11,
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            +{pendingDraws}
          </div>
        )}
        <span className="font-display" style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          display: 'block',
          marginTop: 4,
        }}>
          {deckSize} left
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <Card card={topCard} size="lg" disabled />
        {activeShape && (
          <div style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-0)',
            border: '1px solid var(--surface-3)',
            padding: '2px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 14, color: SHAPE_STYLES[activeShape].color }}>
              {SHAPE_STYLES[activeShape].icon}
            </span>
            <span className="font-display" style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {activeShape}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
