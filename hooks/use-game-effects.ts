'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { PlayerGameView } from '@/types/messages';
import type { ParticleEngine } from '@/lib/effects/particle-canvas';
import { flashClass, clearAllFlashTimers } from '@/lib/effects/css-effects';
import {
  soundBassDrop,
  soundLightningCrack,
  soundShatter,
  soundComboHit,
  startHeartbeat,
  stopHeartbeat,
  startTensionDrone,
  stopTensionDrone,
} from '@/lib/sounds';

// Shape colors from card.tsx
const SHAPE_COLORS: Record<string, string> = {
  circle: '#4DA6E8',
  star: '#B47AE8',
  cross: '#2ECC71',
  square: '#E8923A',
  triangle: '#E74C3C',
  whot: '#D4A017',
};

const SHAPE_ICONS = ['●', '★', '✚', '■', '▲'];
const SHAPE_COLOR_LIST = ['#4DA6E8', '#B47AE8', '#2ECC71', '#E8923A', '#E74C3C'];

interface GameEffectsRefs {
  boardRef: React.RefObject<HTMLElement | null>;
  overlayRef: React.RefObject<HTMLElement | null>;
  tinubuAvatarRef: React.RefObject<HTMLElement | null>;
  topCardRef: React.RefObject<HTMLElement | null>;
  marketRef: React.RefObject<HTMLElement | null>;
}

interface GameEffectsResult {
  boardClassName: string;
  overlayClassName: string;
  tinubuEyesActive: boolean;
  marketUrgent: boolean;
  comboCount: number;
  showDomainExpansion: boolean;
  onCardPlayed: (cardEl: HTMLElement | null) => void;
}

export function useGameEffects(
  gameState: PlayerGameView | null,
  userId: string | null,
  engine: ParticleEngine | null,
  refs: GameEffectsRefs
): GameEffectsResult {
  const prevState = useRef<PlayerGameView | null>(null);
  const comboCount = useRef(0);
  const tinubuEyesActive = useRef(false);
  const tinubuEyesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const domainActive = useRef(false);
  const domainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightningInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatActive = useRef(false);
  const ambientSpawned = useRef(false);
  const lastEffectTime = useRef<Record<string, number>>({});

  // Debounce effects
  const canFire = useCallback((key: string, cooldownMs = 500) => {
    const now = Date.now();
    const last = lastEffectTime.current[key] ?? 0;
    if (now - last < cooldownMs) return false;
    lastEffectTime.current[key] = now;
    return true;
  }, []);

  // Get center of an element
  const getCenter = useCallback((el: HTMLElement | null) => {
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  // Spawn ambient particles on first game state
  useEffect(() => {
    if (gameState && engine && !ambientSpawned.current) {
      ambientSpawned.current = true;
      engine.spawnAmbient(
        { w: window.innerWidth, h: window.innerHeight },
        SHAPE_ICONS,
        SHAPE_COLOR_LIST,
        12
      );
    }
  }, [gameState, engine]);

  // Main effect dispatcher — runs on every gameState change
  useEffect(() => {
    if (!gameState || !userId) return;
    const prev = prevState.current;
    prevState.current = gameState;
    if (!prev) return;

    const topChanged = prev.topCard.id !== gameState.topCard.id;
    const wasOpponentTurn = !prev.isMyTurn;
    const isOpponentTurn = !gameState.isMyTurn;
    const newTopCard = gameState.topCard;
    const myCards = gameState.myHand.length;
    const oppCards = gameState.opponentCardCount;
    const minCards = Math.min(myCards, oppCards);

    // ── Opponent played a card ──
    if (topChanged && wasOpponentTurn) {
      const cardNum = newTopCard.number;
      const isSpecial = [1, 2, 8, 14].includes(cardNum);

      // Screen shake for special cards
      if (isSpecial && canFire('shake')) {
        flashClass(refs.boardRef.current, 'animate-screen-shake', 400);
      }

      // Pick Two — bass drop + combo
      if (cardNum === 2 && canFire('bass')) {
        soundBassDrop();
        comboCount.current++;
        soundComboHit(comboCount.current);

        // Domain Expansion — Tinubu Pick Two when player is low
        if (myCards <= 3 && canFire('domain', 3000)) {
          domainActive.current = true;
          if (domainTimer.current) clearTimeout(domainTimer.current);
          domainTimer.current = setTimeout(() => {
            domainActive.current = false;
          }, 2500);
        }
      }

      // Skip cards — Tinubu eyes
      if ((cardNum === 1 || cardNum === 8) && canFire('eyes')) {
        tinubuEyesActive.current = true;
        if (tinubuEyesTimer.current) clearTimeout(tinubuEyesTimer.current);
        tinubuEyesTimer.current = setTimeout(() => {
          tinubuEyesActive.current = false;
        }, 1500);
      }

      // Whot! — shockwave
      if (cardNum === 20 && canFire('shockwave')) {
        const center = getCenter(refs.topCardRef.current);
        engine?.spawnShockwave(center, SHAPE_COLORS[gameState.activeShape ?? 'whot'] ?? '#D4A017');
        engine?.spawnBurst(center, SHAPE_COLORS[gameState.activeShape ?? 'whot'] ?? '#D4A017', 25);
      }

      // General Market (14) — particle burst
      if (cardNum === 14 && canFire('market-burst')) {
        const center = getCenter(refs.topCardRef.current);
        engine?.spawnBurst(center, SHAPE_COLORS[newTopCard.shape] ?? '#D4A017', 15);
      }

      // Tinubu thinking orbit particles
      if (canFire('orbit', 2000)) {
        const tinubuCenter = getCenter(refs.tinubuAvatarRef.current);
        engine?.spawnOrbit(tinubuCenter, '#8B5CF6', 6);
      }
    }

    // ── Player played a card (top changed while it was our turn) ──
    if (topChanged && !wasOpponentTurn) {
      const cardNum = newTopCard.number;

      // Whot! by player — shockwave
      if (cardNum === 20 && canFire('shockwave')) {
        const center = getCenter(refs.topCardRef.current);
        engine?.spawnShockwave(center, SHAPE_COLORS[gameState.activeShape ?? 'whot'] ?? '#D4A017');
        engine?.spawnBurst(center, SHAPE_COLORS[gameState.activeShape ?? 'whot'] ?? '#D4A017', 20);
      }

      // Pick Two by player
      if (cardNum === 2 && canFire('bass')) {
        soundBassDrop();
        comboCount.current++;
        soundComboHit(comboCount.current);
      }
    }

    // ── Reset combo when pending draws resolve ──
    if (prev.pendingDraws > 0 && gameState.pendingDraws === 0) {
      comboCount.current = 0;
    }

    // ── Low card tension (either player ≤ 2 cards) ──
    if (minCards <= 2 && gameState.status === 'active') {
      if (!heartbeatActive.current) {
        heartbeatActive.current = true;
        startHeartbeat();
        startTensionDrone(minCards === 1 ? 0.8 : 0.4);
      }

      // Lightning cracks
      if (!lightningInterval.current) {
        lightningInterval.current = setInterval(() => {
          if (!engine) return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const from = { x: Math.random() * w * 0.3, y: 0 };
          const to = { x: w * 0.3 + Math.random() * w * 0.4, y: h * 0.6 + Math.random() * h * 0.3 };
          engine.spawnLightning(from, to, '#FFD700');
          soundLightningCrack();
          flashClass(refs.overlayRef.current, 'animate-lightning-flash', 300);
        }, 3000 + Math.random() * 3000);
      }
    } else {
      if (heartbeatActive.current) {
        heartbeatActive.current = false;
        stopHeartbeat();
        stopTensionDrone();
      }
      if (lightningInterval.current) {
        clearInterval(lightningInterval.current);
        lightningInterval.current = null;
      }
    }

    // ── Game over effects ──
    if (gameState.status === 'finished' && prev.status === 'active') {
      // Stop tension
      stopHeartbeat();
      stopTensionDrone();
      heartbeatActive.current = false;
      if (lightningInterval.current) {
        clearInterval(lightningInterval.current);
        lightningInterval.current = null;
      }

      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      if (gameState.winner === userId) {
        // WIN — confetti burst waves
        const colors = ['#D4A017', '#E8B930', '#22B88D', '#4DA6E8', '#B47AE8'];
        engine?.spawnConfetti(center, colors, 50);
        setTimeout(() => engine?.spawnConfetti({ ...center, y: center.y - 50 }, colors, 40), 500);
        setTimeout(() => engine?.spawnConfetti({ ...center, y: center.y + 50 }, colors, 30), 1000);
      } else {
        // LOSE — shatter + cracks + Tinubu victory
        soundShatter();
        flashClass(refs.overlayRef.current, 'animate-screen-crack', 4000);
        engine?.spawnShatter(center, '#E74C3C', 30);
        setTimeout(() => {
          engine?.spawnHollowPurple(center);
        }, 400);
      }
    }
  }, [gameState, userId, engine, refs, canFire, getCenter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      stopTensionDrone();
      clearAllFlashTimers();
      if (lightningInterval.current) clearInterval(lightningInterval.current);
      if (tinubuEyesTimer.current) clearTimeout(tinubuEyesTimer.current);
      if (domainTimer.current) clearTimeout(domainTimer.current);
    };
  }, []);

  // Card play handler — spawns trail from card to top card
  const onCardPlayed = useCallback((cardEl: HTMLElement | null) => {
    if (!engine || !cardEl) return;
    const from = getCenter(cardEl);
    const to = getCenter(refs.topCardRef.current);
    const topCard = prevState.current?.topCard;
    const color = topCard ? (SHAPE_COLORS[topCard.shape] ?? '#D4A017') : '#D4A017';
    engine.spawnTrail(from, to, color, 20);
  }, [engine, refs, getCenter]);

  // Compute derived state
  const myCards = gameState?.myHand.length ?? 10;
  const oppCards = gameState?.opponentCardCount ?? 10;
  const playerAdvantage = oppCards - myCards;

  let boardClassName = '';
  if (gameState?.status === 'active') {
    if (Math.min(myCards, oppCards) <= 2) boardClassName += ' animate-heartbeat';
    if (playerAdvantage >= 3) boardClassName += ' board-tint-green';
    else if (playerAdvantage <= -3) boardClassName += ' board-tint-red';
  }

  // Market urgent — must draw, no playable cards, it's my turn
  const marketUrgent = Boolean(
    gameState?.isMyTurn &&
    gameState.pendingDraws === 0 &&
    gameState.myHand.length > 0 &&
    gameState.status === 'active'
  );

  return {
    boardClassName: boardClassName.trim(),
    overlayClassName: domainActive.current ? 'animate-domain-expansion' : '',
    tinubuEyesActive: tinubuEyesActive.current,
    marketUrgent,
    comboCount: comboCount.current,
    showDomainExpansion: domainActive.current,
    onCardPlayed,
  };
}
