import type { ReactNode, CSSProperties } from 'react';

export interface SpaceProps {
  direction?: 'horizontal' | 'vertical';
  size?: number | [number, number];
  wrap?: boolean;
  align?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Space({
  direction = 'horizontal',
  size = 8,
  wrap,
  align,
  style,
  children,
}: SpaceProps) {
  const gap = Array.isArray(size) ? `${size[1]}px ${size[0]}px` : size;
  return (
    <div
      className={`kp-space${direction === 'vertical' ? ' kp-space--v' : ''}`}
      style={{ gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: align as any, ...style }}
    >
      {children}
    </div>
  );
}
