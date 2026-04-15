/**
 * Rigged Mode — Score-aware aggression system.
 *
 * Uses perfect knowledge of opponent hand + turn history to dynamically
 * shift between threat/cushion/momentum-kill modes.
 * Applies as an outer filter on top of Layer 2-5 doctrine.
 */

import type { Card, Shape, GameLogEntry } from '@/types/game';
import type { AIGameState, AIMove, OpponentModel } from './types';
import { SHAPES } from './types';

export type RiggedMode = 'threat' | 'cushion' | 'momentum_kill' | 'blocking';

export interface RiggedContext {
  mode: RiggedMode;
  humanHandSize: number;
  aiHandSize: number;
  scoreGap: number;          // positive = AI ahead (more cards), negative = AI behind
  humanMomentum: number;     // how many cards human shed in last 3 turns (positive = human improving)
  humanOnStreak: boolean;    // human played 2+ cards in last 3 turns without picking
}

/**
 * Compute the rigged mode context from game state + turn history.
 * Called once per AI turn in rigged mode.
 */
export function computeRiggedContext(
  aiState: AIGameState,
  opponentHand: Card[],
  turnLog: GameLogEntry[],
  opponentId: string,
): RiggedContext {
  const humanHandSize = opponentHand.length;
  const aiHandSize = aiState.hand.length;
  const scoreGap = aiHandSize - humanHandSize; // positive = AI has more cards (losing)

  // Compute human momentum: cards shed in last 3 turns
  const humanMomentum = computeHumanMomentum(turnLog, opponentId);
  const humanOnStreak = humanMomentum >= 2;

  // Determine mode
  let mode: RiggedMode;
  if (humanMomentum >= 3) {
    mode = 'momentum_kill';
  } else if (humanHandSize <= 2) {
    mode = 'blocking';
  } else if (humanHandSize < aiHandSize) {
    mode = 'threat';
  } else {
    mode = 'cushion';
  }

  // Never stay in cushion mode if human is gaining
  if (mode === 'cushion' && humanMomentum >= 1 && humanHandSize <= aiHandSize + 2) {
    mode = 'threat';
  }

  return { mode, humanHandSize, aiHandSize, scoreGap, humanMomentum, humanOnStreak };
}

/**
 * Compute how many cards the human shed in the last 3 turns.
 * A positive value means they are improving (playing cards, not picking).
 */
function computeHumanMomentum(turnLog: GameLogEntry[], opponentId: string): number {
  // Look at last 6 log entries (roughly last 3 turns per player)
  const recentEntries = turnLog.slice(-6);
  const humanEntries = recentEntries.filter((e) => e.playerId === opponentId);

  let cardsPlayed = 0;
  let cardsPicked = 0;

  for (const entry of humanEntries) {
    if (entry.action.type === 'play') cardsPlayed++;
    if (entry.action.type === 'draw') cardsPicked++;
  }

  return cardsPlayed - cardsPicked;
}

/**
 * Apply rigged doctrine modifiers on top of base doctrine.
 * Returns additional score modifier for a card.
 */
export function applyRiggedDoctrine(
  card: Card,
  aiState: AIGameState,
  ctx: RiggedContext,
  opponentHand: Card[],
): number {
  let modifier = 0;

  switch (ctx.mode) {
    case 'momentum_kill':
      // Sacrifice efficiency to stop the human's streak
      // Strongly prioritize any card that forces a pick or skip
      if (card.number === 1) modifier -= 40; // Hold On — skip their turn immediately
      if (card.number === 2) modifier -= 40; // Pick Two — force them to draw
      if (card.number === 14) modifier -= 30; // General Market — force a draw
      if (card.number === 20) modifier -= 25; // Whot — change the suit to something they can't match
      break;

    case 'blocking':
      // Human at ≤2 cards — all-out defense
      if (card.number === 1) modifier -= 50;
      if (card.number === 2) modifier -= 50;
      // Do NOT play General Market if human has 1 card — they draw but you waste a turn
      if (card.number === 14 && ctx.humanHandSize === 1) modifier += 20;
      else if (card.number === 14) modifier -= 20;
      break;

    case 'threat':
      // Human is ahead — play aggressively but smartly
      // Hoard attack cards until they're most effective
      if (card.number === 1 || card.number === 2) {
        // Only play if human has ≤3 cards or human is on a streak
        if (ctx.humanHandSize <= 3 || ctx.humanOnStreak) {
          modifier -= 30;
        } else {
          modifier += 15; // hoard it — wait for the right moment
        }
      }
      // General Market: only when human is on a winning streak
      if (card.number === 14) {
        if (ctx.humanOnStreak) modifier -= 20;
        else modifier += 10;
      }
      break;

    case 'cushion':
      // AI is ahead — play efficiently, burn orphan cards
      // Hold specials for when human catches up
      if (card.number === 1 || card.number === 2) modifier += 10; // save
      if (card.number === 14) modifier += 5; // save
      // Prefer playing high-number orphan cards (no connectivity)
      const sameShape = aiState.hand.filter((c) => c.shape === card.shape && c.id !== card.id).length;
      const sameNumber = aiState.hand.filter((c) => c.number === card.number && c.id !== card.id).length;
      if (sameShape === 0 && sameNumber === 0 && card.number >= 7) {
        modifier -= 8; // encourage playing orphan high-value cards
      }
      break;
  }

  return modifier;
}

/**
 * Score-aware Whot shape selection for rigged mode.
 * Cross-references opponent hand, deck composition, and game mode.
 */
export function pickRiggedWhotShape(
  aiHand: Card[],
  whotCard: Card,
  opponentHand: Card[],
  unseenCards: Card[],
  ctx: RiggedContext,
): Shape {
  const oppCounts: Record<Shape, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
  for (const c of opponentHand) {
    if (c.shape !== 'whot') oppCounts[c.shape as Shape]++;
  }

  const myCounts: Record<Shape, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
  for (const c of aiHand) {
    if (c.id === whotCard.id || c.shape === 'whot') continue;
    myCounts[c.shape as Shape]++;
  }

  // Count unseen cards per shape (deck composition)
  const unseenCounts: Record<Shape, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
  for (const c of unseenCards) {
    if (c.shape !== 'whot') unseenCounts[c.shape as Shape]++;
  }

  let bestShape: Shape = 'circle';
  let bestScore = -Infinity;

  for (const shape of SHAPES) {
    let score = 0;

    if (ctx.mode === 'momentum_kill' || ctx.mode === 'blocking' || ctx.mode === 'threat') {
      // Denial mode: maximize damage to opponent
      // Massive bonus for shapes opponent has ZERO of
      if (oppCounts[shape] === 0) score += 200;
      else score -= oppCounts[shape] * 20;

      // If human is close to winning, prefer rarest suit in unseen pool
      // This maximizes probability they can't find it even after drawing
      if (ctx.humanHandSize <= 3) {
        score -= unseenCounts[shape] * 3; // rarer in deck = harder to find
      }
    } else {
      // Cushion mode: optimize for our own chain
      score += myCounts[shape] * 10;
      // Still mild penalty for opponent's strong suits
      score -= oppCounts[shape] * 5;
    }

    // Always factor in our follow-up potential
    score += myCounts[shape] * 3;

    if (score > bestScore) {
      bestScore = score;
      bestShape = shape;
    }
  }

  return bestShape;
}
