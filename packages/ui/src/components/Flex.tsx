import type { ReactNode, CSSProperties } from 'react';
export interface FlexProps {
  gap?: number | 'small' | 'middle' | 'large';
  vertical?: boolean;
  justify?: string;
  align?: string;
  wrap?: boolean | string;
  flex?: number | string;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}
const GAP: Record<string, number> = { small: 8, middle: 16, large: 24 };
export function Flex({
  gap = 8,
  vertical,
  justify,
  align,
  wrap,
  flex,
  style,
  className,
  children,
}: FlexProps) {
  return (
    <div
      className={`kp-flex${className ? ' ' + className : ''}`}
      style={{
        flexDirection: vertical ? 'column' : 'row',
        gap: typeof gap === 'string' ? GAP[gap] : gap,
        justifyContent: justify as any,
        alignItems: align as any,
        flexWrap: wrap === true ? 'wrap' : (wrap as any),
        flex,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
