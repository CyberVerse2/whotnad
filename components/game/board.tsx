'use client';

import { useState, useCallback } from 'react';
import type { Shape } from '@/types/game';
import type { PlayerGameView } from '@/types/messages';
import { getPlayableCards } from '@/lib/game-engine/rules';
import Link from 'next/link';
import { Card, CardBack, SHAPE_STYLES } from './card';
import { ShapePicker } from './shape-picker';
import { LastCardButton } from './last-card-button';

interface BoardProps {
  gameState: PlayerGameView;
  userId: string;
  walletAddress: string | null;
  balance: string | null;
  onPlayCard: (cardId: number, chosenShape?: Shape) => void;
  onDraw: () => void;
  onDeclareLastCard: () => void;
  onLeave: () => void;
  lastAgentThinkMs: number | null;
  log: Array<{ turn: number; playerId: string; action: { type: string; cardId?: number; chosenShape?: string } }>;
}

export function Board({
  gameState,
  userId,
  walletAddress,
  balance,
  onPlayCard,
  onDraw,
  onDeclareLastCard,
  onLeave,
  lastAgentThinkMs,
}: BoardProps) {
  const [pendingWhotCardId, setPendingWhotCardId] = useState<number | null>(null);

  const playableCards = gameState.isMyTurn
    ? getPlayableCards(
        gameState.myHand,
        gameState.topCard,
        gameState.activeShape,
        gameState.pendingDraws,
        gameState.pendingDrawType
      )
    : [];

  const playableCardIds = playableCards.map((c) => c.id);

  const handlePlayCard = useCallback(
    (cardId: number) => {
      const card = gameState.myHand.find((c) => c.id === cardId);
      if (!card) return;
      if (card.shape === 'whot') {
        setPendingWhotCardId(cardId);
        return;
      }
      onPlayCard(cardId);
    },
    [gameState.myHand, onPlayCard]
  );

  const handleShapeSelect = useCallback(
    (shape: Shape) => {
      if (pendingWhotCardId !== null) {
        onPlayCard(pendingWhotCardId, shape);
        setPendingWhotCardId(null);
      }
    },
    [pendingWhotCardId, onPlayCard]
  );

  const canDraw =
    gameState.isMyTurn &&
    (playableCards.length === 0 || gameState.pendingDraws > 0);
  const drawHint = !gameState.isMyTurn
    ? "Wait for your turn"
    : gameState.pendingDraws > 0
      ? `Draw ${gameState.pendingDraws} card${gameState.pendingDraws === 1 ? '' : 's'} or stack a ${gameState.pendingDrawType}`
      : playableCards.length > 0
        ? 'Play a valid card before drawing from the market'
        : 'Draw from the market';

  const showLastCardButton =
    gameState.isMyTurn &&
    gameState.myHand.length === 2 &&
    !gameState.lastCardDeclared;

  return (
    <div className="felt-texture" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      padding: '16px',
      gap: 16,
    }}>
      {/* ── Header ── */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
      }}>
        <span className="font-display" style={{
          fontSize: 16,
          fontWeight: 900,
          color: 'var(--text-primary)',
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>NAD</span>
        </span>
        <Link
          href={`/profile/${userId}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 6,
            background: 'var(--surface-1)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-1)')}
        >
          {balance !== null && (
            <span className="font-display" style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--gold-base)',
            }}>
              {parseFloat(balance).toFixed(2)} MON
            </span>
          )}
          {walletAddress && (
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
        </Link>
      </nav>

      {/* ── Section 1: Opponent ── */}
      <section style={{
        background: 'var(--surface-1)',
        borderRadius: 10,
        padding: '16px 20px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}>
          <span className="font-display" style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            letterSpacing: '0.06em',
          }}>
            OPPONENT — {gameState.opponentCardCount} CARDS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!gameState.isMyTurn && gameState.status === 'active' && (
              <span className="animate-turn-pulse" style={{
                fontSize: 12,
                color: 'var(--accent)',
                fontStyle: 'italic',
              }}>
                Thinking...
              </span>
            )}
            <button
              onClick={onLeave}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--danger)',
                background: 'none',
                border: '1px solid var(--danger)',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--danger)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              LEAVE
            </button>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          {Array.from({ length: Math.min(gameState.opponentCardCount, 12) }).map((_, i) => (
            <CardBack key={i} size="sm" animated delay={i * 0.04} />
          ))}
          {gameState.opponentCardCount > 12 && (
            <span className="font-display" style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              alignSelf: 'center',
              marginLeft: 4,
            }}>
              +{gameState.opponentCardCount - 12}
            </span>
          )}
        </div>
      </section>

      {/* ── Section 2: Market / Status / Top Card ── */}
      <section style={{
        background: 'var(--surface-1)',
        borderRadius: 10,
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flex: 1,
        minHeight: 160,
      }}>
        {/* Market (draw pile) */}
        <div>
          <span className="font-display" style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            display: 'block',
            marginBottom: 8,
          }}>
            MARKET
          </span>
          <button
            onClick={onDraw}
            disabled={!canDraw}
            className={canDraw ? 'animate-pulse-glow' : ''}
            aria-label={drawHint}
            title={drawHint}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: canDraw ? 'pointer' : 'not-allowed',
              transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
              position: 'relative',
              opacity: canDraw ? 1 : 0.5,
            }}
            onMouseEnter={(e) => canDraw && (e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
            onMouseDown={(e) => canDraw && (e.currentTarget.style.transform = 'translateY(0) scale(0.96)')}
            onMouseUp={(e) => canDraw && (e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)')}
          >
            <CardBack size="lg" />
            {gameState.pendingDraws > 0 && (
              <div style={{
                position: 'absolute',
                top: -6,
                right: -6,
                background: 'var(--danger)',
                color: '#fff',
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
                +{gameState.pendingDraws}
              </div>
            )}
          </button>
          <span className="font-display" style={{
            fontSize: 11,
            fontWeight: 600,
            color: canDraw ? 'var(--text-muted)' : 'var(--danger)',
            letterSpacing: '0.05em',
            display: 'block',
            marginTop: 6,
          }}>
            {canDraw ? `${gameState.deckSize} LEFT` : drawHint.toUpperCase()}
          </span>
        </div>

        {/* Center: turn status */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p
            className={`font-display ${gameState.isMyTurn ? 'animate-pulse-glow' : ''}`}
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: gameState.isMyTurn ? 'var(--accent)' : 'var(--text-muted)',
              letterSpacing: '0.05em',
              marginBottom: 6,
              borderRadius: 6,
              padding: '4px 12px',
              display: 'inline-block',
            }}
          >
            {gameState.isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
          </p>

          {/* Active shape indicator */}
          {gameState.activeShape && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Shape:</span>
              <span style={{
                fontSize: 16,
                color: SHAPE_STYLES[gameState.activeShape].color,
              }}>
                {SHAPE_STYLES[gameState.activeShape].icon}
              </span>
              <span className="font-display" style={{
                fontSize: 13,
                fontWeight: 700,
                color: SHAPE_STYLES[gameState.activeShape].color,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {gameState.activeShape}
              </span>
            </div>
          )}

          {gameState.pendingDraws > 0 && (
            <p className="font-display" style={{
              fontSize: 13,
              fontWeight: 800,
              color: gameState.isMyTurn ? 'var(--danger)' : 'var(--accent)',
              letterSpacing: '0.05em',
              marginTop: 6,
            }}>
              {gameState.isMyTurn
                ? `YOU MUST DRAW ${gameState.pendingDraws} OR PLAY A ${gameState.pendingDrawType}`
                : `OPPONENT OWES +${gameState.pendingDraws} CARDS`
              }
            </p>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 8,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Turn {gameState.turnCount}
            </span>
            {lastAgentThinkMs !== null && (
              <span style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                AI thought {(lastAgentThinkMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Top card */}
        <div>
          <span className="font-display" style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            display: 'block',
            marginBottom: 8,
            textAlign: 'right',
          }}>
            TOP CARD
          </span>
          <div key={`${gameState.topCard.id}-${gameState.turnCount}`} className="animate-scale-in">
            <Card card={gameState.topCard} size="lg" disabled />
          </div>
        </div>
      </section>

      {/* ── Section 3: Your hand ── */}
      <section style={{
        background: 'var(--surface-1)',
        borderRadius: 10,
        padding: '16px 20px',
      }}>
        <span className="font-display" style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          letterSpacing: '0.06em',
          display: 'block',
          marginBottom: 12,
        }}>
          YOUR HAND — {gameState.myHand.length} CARDS
        </span>
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          {gameState.myHand.map((card, i) => {
            const isPlayable = gameState.isMyTurn && playableCardIds.includes(card.id);
            return (
              <div
                key={card.id}
                className="animate-card-deal"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <Card
                  card={card}
                  onClick={() => isPlayable && handlePlayCard(card.id)}
                  disabled={!isPlayable}
                  highlighted={isPlayable}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Modals */}
      {pendingWhotCardId !== null && (
        <ShapePicker onSelect={handleShapeSelect} />
      )}

      <LastCardButton
        onDeclare={onDeclareLastCard}
        visible={showLastCardButton}
      />
    </div>
  );
}
