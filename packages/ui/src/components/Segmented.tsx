import type { ReactNode } from 'react';

export interface SegmentedOption {
  label?: ReactNode;
  value: string | number;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface SegmentedProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (v: string | number) => void;
  options: (SegmentedOption | string | number)[];
  block?: boolean;
  size?: 'small' | 'middle' | 'large';
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: unknown;
}

export function Segmented({
  value,
  defaultValue,
  onChange,
  options,
  block,
  style,
  className,
}: SegmentedProps) {
  const current = value ?? defaultValue;
  const opts: SegmentedOption[] = options.map((o) =>
    typeof o === 'object' ? o : { label: String(o), value: o },
  );
  return (
    <div
      className={`kp-seg${block ? ' kp-seg--block' : ''}${className ? ' ' + className : ''}`}
      style={style}
    >
      {opts.map((o) => (
        <button
          key={String(o.value)}
          className={o.value === current ? 'active' : ''}
          disabled={o.disabled}
          onClick={() => onChange?.(o.value)}
        >
          {o.icon}
          {o.label ?? String(o.value)}
        </button>
      ))}
    </div>
  );
}
