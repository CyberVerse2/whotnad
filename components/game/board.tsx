'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Shape } from '@/types/game';
import type { PlayerGameView } from '@/types/messages';
import { getPlayableCards } from '@/lib/game-engine/rules';
import Link from 'next/link';
import { Card, CardBack, SHAPE_STYLES } from './card';
import { ShapePicker } from './shape-picker';
import { EffectsOverlay, type EffectsOverlayHandle } from './effects-overlay';
import { TinubuAvatar } from './tinubu-avatar';
import { ComboMeter } from './combo-meter';
import { useGameEffects } from '@/hooks/use-game-effects';
import {
  soundCardPlay,
  soundCardDraw,
  soundOpponentPlay,
  soundYourTurn,
  soundError,
  soundPickStack,
} from '@/lib/sounds';

interface BoardProps {
  gameState: PlayerGameView;
  userId: string;
  onPlayCard: (cardId: number, chosenShape?: Shape) => void;
  onDraw: () => void;
  onLeave: () => void;
  onForfeit: () => void;
  forfeiting: boolean;
  lastAgentThinkMs: number | null;
  lastAgentThought: string | null;
  log: Array<{ turn: number; playerId: string; action: { type: string; cardId?: number; chosenShape?: string } }>;
}

export function Board({
  gameState,
  userId,
  onPlayCard,
  onDraw,
  onLeave,
  onForfeit,
  forfeiting,
  lastAgentThinkMs,
  lastAgentThought,
}: BoardProps) {
  const [pendingWhotCardId, setPendingWhotCardId] = useState<number | null>(null);
  const [opponentJustPlayed, setOpponentJustPlayed] = useState(false);
  const [flyingCard, setFlyingCard] = useState<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    key: number;
  } | null>(null);
  const prevTurnRef = useRef(gameState.turnCount);
  const prevIsMyTurnRef = useRef(gameState.isMyTurn);
  const opponentSectionRef = useRef<HTMLDivElement>(null);
  const topCardRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const effectsRef = useRef<EffectsOverlayHandle>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tinubuAvatarRef = useRef<HTMLDivElement>(null);
  const marketRef = useRef<HTMLButtonElement>(null);

  const {
    boardClassName,
    overlayClassName,
    tinubuEyesActive,
    marketUrgent,
    comboCount,
    onCardPlayed,
  } = useGameEffects(
    gameState,
    userId,
    effectsRef.current?.engine ?? null,
    { boardRef, overlayRef, tinubuAvatarRef, topCardRef, marketRef }
  );

  // Detect when opponent finishes their turn → it becomes our turn
  useEffect(() => {
    const turnChanged = gameState.turnCount !== prevTurnRef.current;
    const wasOpponentTurn = !prevIsMyTurnRef.current;
    const isNowMyTurn = gameState.isMyTurn;

    if (turnChanged && wasOpponentTurn && isNowMyTurn) {
      setOpponentJustPlayed(true);
      soundOpponentPlay();
      setTimeout(() => soundYourTurn(), 300);

      // Launch flying card from opponent area to top card
      const opEl = opponentSectionRef.current;
      const topEl = topCardRef.current;
      if (opEl && topEl) {
        const opRect = opEl.getBoundingClientRect();
        const topRect = topEl.getBoundingClientRect();
        setFlyingCard({
          x: opRect.left + opRect.width / 2 - 36,
          y: opRect.top + opRect.height / 2 - 54,
          targetX: topRect.left + topRect.width / 2 - 36,
          targetY: topRect.top + topRect.height / 2 - 54,
          key: gameState.turnCount,
        });
      }

      const timer = setTimeout(() => {
        setOpponentJustPlayed(false);
        setFlyingCard(null);
      }, 600);
      return () => clearTimeout(timer);
    }

    prevTurnRef.current = gameState.turnCount;
    prevIsMyTurnRef.current = gameState.isMyTurn;
  }, [gameState.turnCount, gameState.isMyTurn]);

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
    (cardId: number, cardEl?: HTMLElement | null) => {
      const card = gameState.myHand.find((c) => c.id === cardId);
      if (!card) return;
      if (card.shape === 'whot') {
        setPendingWhotCardId(cardId);
        soundCardPlay();
        return;
      }
      soundCardPlay();
      // Play pick stack sound for special draw cards
      if (card.number === 2) {
        setTimeout(() => soundPickStack(), 100);
      }
      // Particle trail from card to top card
      if (cardEl) onCardPlayed(cardEl);
      onPlayCard(cardId);
    },
    [gameState.myHand, onPlayCard, onCardPlayed]
  );

  const handleShapeSelect = useCallback(
    (shape: Shape) => {
      if (pendingWhotCardId !== null) {
        soundCardPlay();
        onPlayCard(pendingWhotCardId, shape);
        setPendingWhotCardId(null);
      }
    },
    [pendingWhotCardId, onPlayCard]
  );

  const canDraw = gameState.isMyTurn;
  const drawHint = !gameState.isMyTurn
    ? "Wait for your turn"
    : gameState.pendingDraws > 0
      ? `Draw ${gameState.pendingDraws} card${gameState.pendingDraws === 1 ? '' : 's'} or stack a ${gameState.pendingDrawType}`
      : 'Draw from the market';

  return (
    <div ref={boardRef} className={`felt-texture ${boardClassName}`} style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      padding: '12px',
      gap: 10,
      transition: 'background-color 1s ease',
    }}>
      <EffectsOverlay ref={effectsRef} overlayClassName={overlayClassName} />

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
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
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
          <span className="font-display" style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            letterSpacing: '0.06em',
          }}>
            PROFILE
          </span>
        </Link>
      </nav>

      {/* Kente-inspired divider */}
      <div className="kente-divider" style={{ borderRadius: 2, opacity: 0.5 }} />

      {/* ── Section 1: Opponent ── */}
      <section ref={opponentSectionRef} style={{
        background: 'var(--surface-1)',
        borderRadius: 10,
        padding: '12px 16px',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div ref={tinubuAvatarRef} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TinubuAvatar
              size={28}
              isThinking={!gameState.isMyTurn && gameState.status === 'active'}
              eyesActive={tinubuEyesActive}
            />
            <span className="font-display" style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '0.06em',
            }}>
              TINUBU — {gameState.opponentCardCount} CARDS
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {!gameState.isMyTurn && gameState.status === 'active' && !lastAgentThought && (
              <span className="animate-turn-pulse" style={{
                fontSize: 12,
                color: 'var(--accent)',
                fontStyle: 'italic',
              }}>
                Thinking...
              </span>
            )}
            {lastAgentThought && (
              <span
                key={gameState.turnCount}
                className={opponentJustPlayed ? 'animate-slide-down' : ''}
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  maxWidth: 320,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {lastAgentThought}
              </span>
            )}
            <button
              onClick={() => {
                if (forfeiting) return;
                if (confirm('Forfeit this match? Your opponent will win.')) {
                  void onForfeit();
                }
              }}
              disabled={forfeiting}
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
                cursor: forfeiting ? 'wait' : 'pointer',
                opacity: forfeiting ? 0.6 : 1,
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
              {forfeiting ? 'FORFEITING...' : 'FORFEIT'}
            </button>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          paddingBottom: 4,
        }}>
          {Array.from({ length: Math.min(gameState.opponentCardCount, 12) }).map((_, i) => (
            <div key={i} style={{ flexShrink: 0 }}>
              <CardBack size="sm" animated delay={i * 0.04} />
            </div>
          ))}
          {gameState.opponentCardCount > 12 && (
            <span className="font-display" style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              alignSelf: 'center',
              marginLeft: 4,
              flexShrink: 0,
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
        padding: '12px 16px',
        border: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
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
            ref={marketRef}
            onClick={() => { soundCardDraw(); onDraw(); }}
            disabled={!canDraw}
            className={marketUrgent && canDraw ? 'animate-market-urgent' : canDraw ? 'animate-pulse-glow' : ''}
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
            <CardBack size="md" />
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
            fontSize: 9,
            fontWeight: 600,
            color: canDraw ? 'var(--text-muted)' : 'var(--danger)',
            letterSpacing: '0.05em',
            display: 'block',
            marginTop: 4,
            maxWidth: 80,
          }}>
            {canDraw ? `${gameState.deckSize} LEFT` : drawHint.toUpperCase()}
          </span>
        </div>

        {/* Center: turn status */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p
            className={`font-display ${gameState.isMyTurn ? 'animate-pulse-glow' : ''}`}
            style={{
              fontSize: 'clamp(14px, 4vw, 20px)',
              fontWeight: 900,
              color: gameState.isMyTurn ? 'var(--accent)' : 'var(--text-muted)',
              letterSpacing: '0.05em',
              marginBottom: 4,
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
                : `TINUBU OWES +${gameState.pendingDraws} CARDS`
              }
            </p>
          )}

          {comboCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <ComboMeter count={comboCount} />
            </div>
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
          <div ref={topCardRef}>
            <div
              key={`${gameState.topCard.id}-${gameState.turnCount}`}
              className={opponentJustPlayed ? 'animate-card-slam' : 'animate-scale-in'}
            >
              <Card card={gameState.topCard} size="md" disabled />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Your hand ── */}
      <section style={{
        background: 'var(--surface-1)',
        borderRadius: 10,
        padding: '12px 16px 16px',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span className="font-display" style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          letterSpacing: '0.06em',
          display: 'block',
          marginBottom: 8,
        }}>
          YOUR HAND — {gameState.myHand.length} CARDS
        </span>
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          paddingTop: 12,
          paddingBottom: 6,
        }}>
          {gameState.myHand.map((card, i) => {
            const isPlayable = gameState.isMyTurn && playableCardIds.includes(card.id);
            return (
              <div
                key={card.id}
                className="animate-card-deal"
                style={{ animationDelay: `${i * 0.05}s`, flexShrink: 0 }}
              >
                <Card
                  card={card}
                  onClick={(e) => {
                    if (!isPlayable) return;
                    const el = (e as React.MouseEvent).currentTarget as HTMLElement;
                    handlePlayCard(card.id, el);
                  }}
                  disabled={!isPlayable}
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

      {/* Flying card animation: opponent card → top card */}
      {flyingCard && (
        <div
          key={flyingCard.key}
          className="animate-card-fly"
          style={{
            position: 'fixed',
            left: flyingCard.x,
            top: flyingCard.y,
            zIndex: 100,
            '--fly-x': `${flyingCard.targetX - flyingCard.x}px`,
            '--fly-y': `${flyingCard.targetY - flyingCard.y}px`,
          } as React.CSSProperties}
        >
          <CardBack size="md" />
        </div>
      )}
    </div>
  );
}
