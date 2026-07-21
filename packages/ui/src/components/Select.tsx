import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}
export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  style?: React.CSSProperties;
  allowClear?: boolean;
  mode?: 'multiple';
}

export function Select({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = 'Выбрать…',
  style,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(value ?? defaultValue);
  const ref = useRef<HTMLDivElement>(null);
  const current = value ?? inner;
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const label = options.find((o) => o.value === current)?.label ?? placeholder;
  return (
    <div className={`kp-dd${open ? ' open' : ''}`} ref={ref} style={style}>
      <div className="kp-input kp-dd-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <svg
          viewBox="0 0 24 24"
          width={14}
          height={14}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l7 8 7-8" />
        </svg>
      </div>
      {open && (
        <div className="kp-dd-menu">
          {options.map((o) => (
            <div
              key={o.value}
              className={`kp-dd-opt${o.value === current ? ' sel' : ''}`}
              onClick={() => {
                setInner(o.value);
                onChange?.(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
