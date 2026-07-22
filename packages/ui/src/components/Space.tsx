import type { ReactNode, CSSProperties } from 'react';

type SpaceSize = number | 'small' | 'middle' | 'large' | [number, number];

export interface SpaceProps {
  direction?: 'horizontal' | 'vertical';
  size?: SpaceSize;
  wrap?: boolean;
  align?: string;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

const NAMED: Record<string, number> = { small: 8, middle: 16, large: 24 };
function toGap(size: SpaceSize): string | number {
  if (Array.isArray(size)) return `${size[1]}px ${size[0]}px`;
  if (typeof size === 'string') return NAMED[size] ?? 8;
  return size;
}

function SpaceBase({
  direction = 'horizontal',
  size = 8,
  wrap,
  align,
  style,
  className,
  children,
}: SpaceProps) {
  return (
    <div
      className={`kp-space${direction === 'vertical' ? ' kp-space--v' : ''}${className ? ' ' + className : ''}`}
      style={{
        gap: toGap(size),
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: align as any,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Compact({ children, style, className }: SpaceProps) {
  return (
    <div className={`kp-space kp-space--compact${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  );
}

export const Space = Object.assign(SpaceBase, { Compact });
