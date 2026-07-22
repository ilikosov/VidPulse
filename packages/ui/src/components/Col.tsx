import type { ReactNode, CSSProperties } from 'react';

type Responsive = number | { span?: number; offset?: number };

export interface ColProps {
  span?: number;
  offset?: number;
  flex?: number | string;
  xs?: Responsive;
  sm?: Responsive;
  md?: Responsive;
  lg?: Responsive;
  xl?: Responsive;
  xxl?: Responsive;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Col({ span, flex, style, className, children }: ColProps) {
  const basis =
    flex != null
      ? typeof flex === 'number'
        ? `${flex} ${flex} 0`
        : flex
      : span != null
        ? `0 0 ${(span / 24) * 100}%`
        : undefined;
  return (
    <div
      className={className}
      style={{
        flex: basis,
        maxWidth: span != null ? `${(span / 24) * 100}%` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
