'use client';

interface LastCardButtonProps {
  onDeclare: () => void;
  visible: boolean;
}

export function LastCardButton({ onDeclare, visible }: LastCardButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onDeclare}
      style={{
        position: 'fixed',
        bottom: 140,
        right: 24,
        zIndex: 40,
        background: 'var(--gold-base)',
        color: '#fff',
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: 16,
        letterSpacing: '0.08em',
        padding: '12px 24px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(184,134,11,0.35)',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      LAST CARD!
    </button>
  );
}
