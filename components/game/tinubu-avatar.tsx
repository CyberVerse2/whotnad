'use client';

interface TinubuAvatarProps {
  size?: number;
  isThinking?: boolean;
  eyesActive?: boolean;
  className?: string;
}

export function TinubuAvatar({
  size = 28,
  isThinking = false,
  eyesActive = false,
  className = '',
}: TinubuAvatarProps) {
  return (
    <div
      className={`${eyesActive ? 'animate-tinubu-eyes' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `2px solid ${eyesActive ? '#8B5CF6' : 'var(--accent)'}`,
        flexShrink: 0,
        position: 'relative',
        transition: 'border-color 0.3s',
      }}
    >
      <img
        src="/tinubu.jpg"
        alt="Tinubu"
        width={size}
        height={size}
        style={{
          objectFit: 'cover',
          display: 'block',
          filter: isThinking ? 'brightness(1.2) saturate(1.3)' : 'none',
          transition: 'filter 0.3s',
        }}
      />
      {/* Eyes glow overlay */}
      {eyesActive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 35% 40%, rgba(139,92,246,0.4) 0%, transparent 50%), radial-gradient(circle at 65% 40%, rgba(99,102,241,0.4) 0%, transparent 50%)',
            borderRadius: '50%',
          }}
        />
      )}
    </div>
  );
}
