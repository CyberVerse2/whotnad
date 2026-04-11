'use client';

import type { Card as CardType } from '@/types/game';
import { Card } from './card';

interface HandProps {
  cards: CardType[];
  playableCardIds: number[];
  onPlayCard: (cardId: number) => void;
  isMyTurn: boolean;
}

export function Hand({ cards, playableCardIds, onPlayCard, isMyTurn }: HandProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 4,
      flexWrap: 'wrap',
      padding: '8px 16px',
    }}>
      {cards.map((card) => {
        const isPlayable = isMyTurn && playableCardIds.includes(card.id);
        return (
          <Card
            key={card.id}
            card={card}
            onClick={() => isPlayable && onPlayCard(card.id)}
            disabled={!isPlayable}
            highlighted={isPlayable}
          />
        );
      })}
    </div>
  );
}
