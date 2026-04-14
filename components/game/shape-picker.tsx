'use client';

import type { Shape } from '@/types/game';
import { SHAPE_STYLES } from './card';

const SHAPES: Shape[] = ['circle', 'triangle', 'cross', 'square', 'star'];

interface ShapePickerProps {
  onSelect: (shape: Shape) => void;
}

export function ShapePicker({ onSelect }: ShapePickerProps) {
  return (
    <div className="animate-fade-in" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }}>
      <div className="animate-scale-in" style={{
        background: 'var(--surface-1)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <h3 className="font-display" style={{
          fontSize: 16,
          fontWeight: 800,
          color: 'var(--text-primary)',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          CALL A SHAPE
        </h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {SHAPES.map((shape) => {
            const s = SHAPE_STYLES[shape];
            return (
              <button
                key={shape}
                onClick={() => onSelect(shape)}
                style={{
                  width: 64,
                  height: 64,
                  background: s.tint,
                  color: s.color,
                  border: '2px solid transparent',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.borderColor = s.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1 }}>{s.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {shape}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
