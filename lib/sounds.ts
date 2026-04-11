'use client';

/**
 * Game sound effects using Web Audio API.
 * No sound files needed — everything is synthesized.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  decay = true
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;

    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

function playNoise(duration: number, volume = 0.05) {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    // Audio not available
  }
}

/** Card played — short crisp tap */
export function soundCardPlay() {
  playTone(800, 0.08, 'square', 0.08);
  playNoise(0.05, 0.06);
}

/** Card drawn from market — soft whoosh */
export function soundCardDraw() {
  playTone(300, 0.15, 'sine', 0.06);
  playTone(200, 0.2, 'sine', 0.04);
}

/** Opponent plays — deeper thud */
export function soundOpponentPlay() {
  playTone(250, 0.12, 'triangle', 0.1);
  playNoise(0.06, 0.04);
}

/** Your turn notification — two-tone chime */
export function soundYourTurn() {
  playTone(660, 0.12, 'sine', 0.1);
  setTimeout(() => playTone(880, 0.15, 'sine', 0.1), 100);
}

/** Last card declared — alert ping */
export function soundLastCard() {
  playTone(1000, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(1200, 0.1, 'sine', 0.1), 80);
  setTimeout(() => playTone(1500, 0.15, 'sine', 0.08), 160);
}

/** Invalid move — low buzz */
export function soundError() {
  playTone(150, 0.2, 'sawtooth', 0.06);
}

/** Game won — ascending celebration */
export function soundWin() {
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 120);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 240);
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.15), 360);
}

/** Game lost — descending */
export function soundLose() {
  playTone(400, 0.2, 'sine', 0.08);
  setTimeout(() => playTone(300, 0.2, 'sine', 0.08), 150);
  setTimeout(() => playTone(200, 0.3, 'sine', 0.06), 300);
}

/** Match found — bright double ping */
export function soundMatchFound() {
  playTone(880, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.12), 120);
}

/** Button click — subtle tick */
export function soundClick() {
  playTone(600, 0.04, 'square', 0.04);
}

/** Pick Two/Three stacked — menacing */
export function soundPickStack() {
  playTone(200, 0.15, 'sawtooth', 0.06);
  setTimeout(() => playTone(180, 0.2, 'sawtooth', 0.05), 100);
}
