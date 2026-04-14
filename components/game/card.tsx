'use client';

import { useState, useRef } from 'react';
import type { Card as CardType, CardShape } from '@/types/game';

const SHAPE_STYLES: Record<CardShape, { color: string; tint: string; bg: string; icon: string }> = {
  circle:   { color: '#4DA6E8', tint: '#1B3A52', bg: '#0F2233', icon: '●' },
  star:     { color: '#B47AE8', tint: '#3D2155', bg: '#241435', icon: '★' },
  cross:    { color: '#2ECC71', tint: '#1A4D2E', bg: '#0F2E1A', icon: '✚' },
  square:   { color: '#E8923A', tint: '#4D3218', bg: '#2E1E0F', icon: '■' },
  triangle: { color: '#E74C3C', tint: '#4D1A15', bg: '#2E0F0C', icon: '▲' },
  whot:     { color: '#D4A017', tint: '#4D3C0A', bg: '#2E2406', icon: '✦' },
};

interface CardProps {
  card: CardType;
  onClick?: (e?: React.MouseEvent) => void;
  disabled?: boolean;
  highlighted?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Card({
  card,
  onClick,
  disabled = false,
  highlighted = false,
  size = 'md',
}: CardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const dims = {
    sm: { w: 56, h: 84 },
    md: { w: 72, h: 108 },
    lg: { w: 88, h: 132 },
  }[size];

  const s = SHAPE_STYLES[card.shape];
  const numSize = size === 'sm' ? 13 : size === 'md' ? 16 : 19;
  const iconSize = size === 'sm' ? 24 : size === 'md' ? 32 : 40;
  const smallIcon = size === 'sm' ? 9 : size === 'md' ? 11 : 13;
  const interactive = !disabled || highlighted;

  // Build transform
  let transform = 'translateY(0) scale(1)';
  if (isPressed && interactive) {
    transform = 'translateY(-2px) scale(0.95)';
  } else if (highlighted && isHovered) {
    transform = 'translateY(-10px) scale(1.04)';
  } else if (highlighted) {
    transform = 'translateY(-6px) scale(1)';
  } else if (isHovered && interactive) {
    transform = 'translateY(-3px) scale(1.02)';
  }

  // Build shadow
  let shadow = '0 2px 6px rgba(0,0,0,0.4)';
  if (isPressed && interactive) {
    shadow = '0 1px 3px rgba(0,0,0,0.5)';
  } else if (highlighted && isHovered) {
    shadow = `0 8px 24px ${s.color}44, 0 0 0 1px ${s.color}33`;
  } else if (highlighted) {
    shadow = `0 4px 16px ${s.color}33, 0 0 0 1px ${s.color}22`;
  } else if (isHovered && interactive) {
    shadow = '0 6px 16px rgba(0,0,0,0.5)';
  }

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled && !highlighted}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => interactive && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        width: dims.w,
        height: dims.h,
        background: s.bg,
        border: highlighted
          ? `2px solid ${s.color}`
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        cursor: interactive ? 'pointer' : 'default',
        opacity: 1,
        transform,
        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), border-color 0.15s, opacity 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: shadow,
        flexShrink: 0,
        padding: 0,
        outline: 'none',
      }}
    >
      {/* Bottom tint wash */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '55%',
        background: `linear-gradient(to top, ${s.tint}, transparent)`,
        transition: 'opacity 0.15s',
        opacity: isHovered && interactive ? 0.9 : 0.7,
      }} />

      {/* Top-left: number + small icon */}
      <div style={{
        position: 'absolute',
        top: size === 'sm' ? 3 : 5,
        left: size === 'sm' ? 5 : 7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: numSize,
          color: s.color,
          lineHeight: 1,
        }}>
          {card.number}
        </span>
        <span style={{
          fontSize: smallIcon,
          color: s.color,
          lineHeight: 1,
          marginTop: 1,
          opacity: 0.7,
        }}>
          {s.icon}
        </span>
      </div>

      {/* Center: big icon */}
      <span style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${isPressed && interactive ? 0.9 : isHovered && interactive ? 1.1 : 1})`,
        fontSize: iconSize,
        color: s.color,
        lineHeight: 1,
        zIndex: 1,
        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
        filter: `drop-shadow(0 0 ${highlighted ? '8px' : '4px'} ${s.color}44)`,
      }}>
        {s.icon}
      </span>

      {/* Bottom-right: rotated number + small icon */}
      <div style={{
        position: 'absolute',
        bottom: size === 'sm' ? 3 : 5,
        right: size === 'sm' ? 5 : 7,
        transform: 'rotate(180deg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        zIndex: 1,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: numSize,
          color: s.color,
          lineHeight: 1,
        }}>
          {card.number}
        </span>
        <span style={{
          fontSize: smallIcon,
          color: s.color,
          lineHeight: 1,
          marginTop: 1,
          opacity: 0.7,
        }}>
          {s.icon}
        </span>
      </div>
    </button>
  );
}

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  delay?: number;
}

export function CardBack({ size = 'md', animated = false, delay = 0 }: CardBackProps) {
  const dims = {
    sm: { w: 56, h: 84 },
    md: { w: 72, h: 108 },
    lg: { w: 88, h: 132 },
  }[size];

  return (
    <div
      className={animated ? 'animate-card-deal' : ''}
      style={{
        width: dims.w,
        height: dims.h,
        background: `
          linear-gradient(135deg, var(--surface-3) 25%, transparent 25%) -8px 0,
          linear-gradient(225deg, var(--surface-3) 25%, transparent 25%) -8px 0,
          linear-gradient(315deg, var(--surface-3) 25%, transparent 25%),
          linear-gradient(45deg, var(--surface-3) 25%, transparent 25%)
        `,
        backgroundColor: 'var(--surface-2)',
        backgroundSize: '16px 16px',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), opacity 0.2s',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        ...(animated ? { animationDelay: `${delay}s` } : {}),
      }}
    >
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size === 'sm' ? 14 : 18,
        color: 'var(--accent)',
        letterSpacing: '0.05em',
        opacity: 0.6,
      }}>
        W
      </span>
    </div>
  );
}

export { SHAPE_STYLES };
