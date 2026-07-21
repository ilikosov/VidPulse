import type { ReactNode } from 'react';

export function Tooltip({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <span className="kp-tt-wrap">
      {children}
      <span className="kp-tt-bubble">{title}</span>
    </span>
  );
}
