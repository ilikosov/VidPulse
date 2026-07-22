import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface AutoCompleteOption {
  value: string;
  label?: ReactNode;
}
export interface AutoCompleteProps {
  options?: (AutoCompleteOption | string)[];
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  onSearch?: (v: string) => void;
  onSelect?: (v: string) => void;
  filterOption?: boolean | ((input: string, option?: AutoCompleteOption) => boolean);
  allowClear?: boolean;
  disabled?: boolean;
  notFoundContent?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

export function AutoComplete({
  options = [],
  placeholder,
  value,
  onChange,
  onSearch,
  onSelect,
  filterOption = true,
  disabled,
  style,
  className,
}: AutoCompleteProps) {
  const opts: AutoCompleteOption[] = options.map((o) => (typeof o === 'string' ? { value: o } : o));
  const [q, setQ] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (value !== undefined) setQ(value);
  }, [value]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered =
    filterOption === false
      ? opts
      : opts.filter((o) =>
          typeof filterOption === 'function'
            ? filterOption(q, o)
            : o.value.toLowerCase().includes(q.toLowerCase()),
        );
  return (
    <div className={`kp-dd${className ? ' ' + className : ''}`} ref={ref} style={style}>
      <input
        className="kp-input"
        placeholder={placeholder}
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          onChange?.(e.target.value);
          onSearch?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="kp-dd-menu">
          {filtered.map((o) => (
            <div
              key={o.value}
              className="kp-dd-opt"
              onClick={() => {
                setQ(o.value);
                onChange?.(o.value);
                onSelect?.(o.value);
                setOpen(false);
              }}
            >
              {o.label ?? o.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
