'use client';

import type { LucideIcon } from 'lucide-react';

type ActionCardProps = {
  icon: LucideIcon;
  label: string;
  color: string;
  cost?: number;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
};

export function ActionCard({
  icon: Icon,
  label,
  color,
  cost,
  disabled = false,
  onClick,
  size = 'md',
}: ActionCardProps) {
  const isButton = !!onClick;
  const cardWidth = size === 'sm' ? 72 : 82;
  const iconSize = size === 'sm' ? 38 : 46;
  const iconPadding = size === 'sm' ? '12px 8px 8px' : '16px 10px 12px';

  const cardInner = (
    <div
      className="action-card-inner"
      style={{
        width: cardWidth,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        overflow: 'hidden',
        border: `2px solid ${color}`,
        boxShadow: `0 0 10px ${color}44`,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
    >
      {/* 아이콘 영역 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: iconPadding,
          background: `linear-gradient(160deg, ${color}2e 0%, ${color}0d 100%)`,
        }}
      >
        <Icon size={iconSize} color={color} strokeWidth={1.6} />
      </div>

      {/* 하단 이름/코스트 영역 */}
      <div
        style={{
          background: '#111',
          borderTop: `1px solid ${color}55`,
          padding: '5px 4px 6px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: size === 'sm' ? 11 : 12,
            fontWeight: 800,
            color: '#f0f0f0',
            letterSpacing: '0.3px',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
        {cost !== undefined && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color,
              marginTop: 2,
            }}
          >
            {cost === 0 ? '무료' : `${cost}코어`}
          </div>
        )}
      </div>
    </div>
  );

  if (isButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="action-card-btn"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {cardInner}
      </button>
    );
  }

  return cardInner;
}
