import type { ReactNode } from 'react';

export interface SegmentedOption {
  label?: ReactNode;
  value: string;
  icon?: ReactNode;
}
export interface SegmentedProps {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  options: SegmentedOption[];
}

export function Segmented({ value, defaultValue, onChange, options }: SegmentedProps) {
  const current = value ?? defaultValue;
  return (
    <div className="kp-seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === current ? 'active' : ''}
          onClick={() => onChange?.(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
