import type { ReactNode } from 'react';

export interface SpinProps {
  size?: number | 'small' | 'default' | 'large';
  spinning?: boolean;
  tip?: ReactNode;
  children?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: unknown;
}

const SIZE: Record<string, number> = { small: 16, default: 22, large: 32 };

export function Spin({ size = 22, spinning = true, tip, children }: SpinProps) {
  const px = typeof size === 'string' ? SIZE[size] : size;
  if (children) {
    return (
      <div className="kp-spin-wrap">
        {children}
        {spinning && (
          <div className="kp-spin-overlay">
            <span className="kp-spin" style={{ width: px, height: px }} />
            {tip}
          </div>
        )}
      </div>
    );
  }
  return spinning ? <span className="kp-spin" style={{ width: px, height: px }} /> : null;
}
