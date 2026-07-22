import type { ReactNode } from 'react';

export interface TooltipProps {
  title?: ReactNode;
  placement?: string;
  children: ReactNode;
  mouseEnterDelay?: number;
  color?: string;
  overlayStyle?: React.CSSProperties;
  [key: string]: unknown;
}

export function Tooltip({ title, children }: TooltipProps) {
  if (title == null || title === '') return <>{children}</>;
  return (
    <span className="kp-tt-wrap">
      {children}
      <span className="kp-tt-bubble">{title}</span>
    </span>
  );
}
