'use client';

/**
 * Game sound effects using Web Audio API.
 * No sound files needed — everything is synthesized.
 */

// ── Global mute control ──

let _muted = false;

export function isMuted(): boolean {
  return _muted;
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('whot-muted', muted ? '1' : '0');
  }
}

export function initMuteState(): void {
  if (typeof window !== 'undefined') {
    _muted = localStorage.getItem('whot-muted') === '1';
  }
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
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

// ── Game Effects Sounds ──

/** Bass drop — Pick Two devastation */
export function soundBassDrop() {
  playTone(60, 0.3, 'sine', 0.2);
  playTone(30, 0.4, 'sine', 0.15);
  playNoise(0.08, 0.08);
}

/** Lightning crack — low card tension */
export function soundLightningCrack() {
  playNoise(0.1, 0.12);
  playTone(2000, 0.05, 'sine', 0.08);
  setTimeout(() => playTone(80, 0.5, 'triangle', 0.06), 50);
}

/** Glass shatter — loss card scatter */
export function soundShatter() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => playNoise(0.03, 0.1), i * 40);
  }
  playTone(1200, 0.08, 'square', 0.05);
}

/** Combo hit — scales with intensity 1-5 */
export function soundComboHit(intensity: number) {
  const freq = 150 + intensity * 30;
  const vol = 0.04 + intensity * 0.02;
  playTone(freq, 0.15, 'sawtooth', Math.min(vol, 0.14));
}

// ── Persistent Heartbeat ──

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat() {
  if (heartbeatInterval) return;
  const beat = () => {
    playTone(60, 0.1, 'sine', 0.06, true);
    setTimeout(() => playTone(45, 0.12, 'sine', 0.04, true), 150);
  };
  beat();
  heartbeatInterval = setInterval(beat, 800);
}

export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ── Tension Drone ──

let droneOsc1: OscillatorNode | null = null;
let droneOsc2: OscillatorNode | null = null;
let droneGain: GainNode | null = null;

export function startTensionDrone(intensity: number) {
  if (droneOsc1) {
    updateTensionDrone(intensity);
    return;
  }
  try {
    const ctx = getCtx();
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.01;
    droneGain.connect(ctx.destination);

    droneOsc1 = ctx.createOscillator();
    droneOsc1.type = 'sine';
    droneOsc1.frequency.value = 55;
    droneOsc1.connect(droneGain);
    droneOsc1.start();

    droneOsc2 = ctx.createOscillator();
    droneOsc2.type = 'sine';
    droneOsc2.frequency.value = 110;
    droneOsc2.connect(droneGain);
    droneOsc2.start();

    updateTensionDrone(intensity);
  } catch {
    // Audio not available
  }
}

export function updateTensionDrone(intensity: number) {
  if (!droneGain) return;
  try {
    const ctx = getCtx();
    const vol = Math.min(0.04, 0.01 + intensity * 0.03);
    droneGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.5);
    if (droneOsc1) droneOsc1.detune.linearRampToValueAtTime(intensity * 20, ctx.currentTime + 0.5);
  } catch { /* ignore */ }
}

export function stopTensionDrone() {
  try {
    if (droneOsc1) { droneOsc1.stop(); droneOsc1 = null; }
    if (droneOsc2) { droneOsc2.stop(); droneOsc2 = null; }
    if (droneGain) { droneGain.disconnect(); droneGain = null; }
  } catch { /* ignore */ }
}

// ── Tinubu pre-rendered voice lines ──
// 110 MP3 files in /voice/001.mp3 through /voice/110.mp3
// Server picks the exact line number so text and audio always match.

let currentTinubuAudio: HTMLAudioElement | null = null;

/**
 * Play a specific pre-rendered Tinubu voice line by its number (1-110).
 * The server picks the number to ensure text and audio match.
 */
export function playTinubuVoice(lineNumber: number): void {
  if (_muted) return;
  if (lineNumber < 1 || lineNumber > 210) return;

  // Stop any currently playing line
  if (currentTinubuAudio) {
    currentTinubuAudio.pause();
    currentTinubuAudio = null;
  }

  try {
    const padded = String(lineNumber).padStart(3, '0');
    const audio = new Audio(`/voice/${padded}.mp3`);
    audio.volume = 0.7;
    currentTinubuAudio = audio;

    audio.onended = () => {
      if (currentTinubuAudio === audio) currentTinubuAudio = null;
    };

    audio.play().catch(() => {
      // Audio not available — silent fail
    });
  } catch {
    // Audio not available
  }
}
