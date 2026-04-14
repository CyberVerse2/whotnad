import type { Card } from '@/types/game';

/**
 * Deterministic Fisher-Yates shuffle using a seeded PRNG.
 * Given the same seed, always produces the same card order.
 * The seed is derived from Drand randomness for verifiability.
 */
export function shuffleDeck(deck: Card[], seed: string): Card[] {
  const shuffled = [...deck];
  const rng = createSeededRng(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Simple seeded PRNG (mulberry32).
 * Deterministic: same seed → same sequence of numbers.
 */
function createSeededRng(seed: string): () => number {
  let h = hashString(seed);
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simple string hash function (djb2).
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Compute a SHA-256 hash of the deck order for verification.
 * Returns hex string.
 */
export async function computeDeckHash(deck: Card[]): Promise<string> {
  const deckString = deck.map((c) => `${c.shape}:${c.number}`).join(',');
  const encoder = new TextEncoder();
  const data = encoder.encode(deckString);

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  const { createHash } = await import('crypto');
  return createHash('sha256').update(deckString).digest('hex');
}
