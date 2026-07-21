import type { ReactNode } from 'react';

export interface DescriptionsProps {
  items: { label: ReactNode; value: ReactNode }[];
}

export function Descriptions({ items }: DescriptionsProps) {
  return (
    <div className="kp-desc">
      {items.map((it, i) => (
        <div className="kp-drow" key={i}>
          <span className="kp-drow-label">{it.label}</span>
          <span className="kp-drow-val">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
