import type { ReactNode, CSSProperties } from 'react';
export interface FlexProps {
  gap?: number;
  vertical?: boolean;
  justify?: string;
  align?: string;
  style?: CSSProperties;
  children?: ReactNode;
}
export function Flex({ gap = 8, vertical, justify, align, style, children }: FlexProps) {
  return (
    <div
      className="kp-flex"
      style={{
        flexDirection: vertical ? 'column' : 'row',
        gap,
        justifyContent: justify as any,
        alignItems: align as any,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
