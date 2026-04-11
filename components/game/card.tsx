'use client';

import { useState, useRef } from 'react';
import type { Card as CardType, CardShape } from '@/types/game';

const SHAPE_STYLES: Record<CardShape, { color: string; tint: string; icon: string }> = {
  circle:   { color: '#1a5fb4', tint: '#c4daf6', icon: '●' },
  star:     { color: '#613583', tint: '#d5c5e8', icon: '★' },
  cross:    { color: '#2d6328', tint: '#cce5ca', icon: '✚' },
  square:   { color: '#6b3a1f', tint: '#f5d5b8', icon: '■' },
  triangle: { color: '#8b2025', tint: '#f2c4c6', icon: '▲' },
  whot:     { color: '#7d5c07', tint: '#eee8d5', icon: '✦' },
};

interface CardProps {
  card: CardType;
  onClick?: () => void;
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
  let shadow = '0 1px 3px rgba(0,0,0,0.1)';
  if (isPressed && interactive) {
    shadow = '0 2px 4px rgba(0,0,0,0.15)';
  } else if (highlighted && isHovered) {
    shadow = `0 8px 24px ${s.color}33`;
  } else if (highlighted) {
    shadow = `0 4px 16px ${s.color}22`;
  } else if (isHovered && interactive) {
    shadow = '0 4px 12px rgba(0,0,0,0.12)';
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
        background: '#fff',
        border: highlighted
          ? `2px solid ${s.color}`
          : '1px solid #d4d4d4',
        borderRadius: 8,
        cursor: interactive ? 'pointer' : 'default',
        opacity: disabled && !highlighted ? 0.45 : 1,
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
      {/* Bottom tint */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        background: s.tint,
        transition: 'opacity 0.15s',
        opacity: isHovered && interactive ? 0.85 : 1,
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
          fontWeight: 800,
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
          fontWeight: 800,
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
        background: 'var(--surface-1)',
        border: '1px solid var(--surface-3)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), opacity 0.2s',
        ...(animated ? { animationDelay: `${delay}s` } : {}),
      }}
    >
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: size === 'sm' ? 16 : 20,
        color: 'var(--text-muted)',
        letterSpacing: '0.05em',
      }}>
        W
      </span>
    </div>
  );
}

export { SHAPE_STYLES };
