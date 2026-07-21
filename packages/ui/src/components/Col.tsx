import type { ReactNode, CSSProperties } from 'react';
export function Col({
  span,
  style,
  children,
}: {
  span?: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return <div style={style}>{children}</div>;
}
