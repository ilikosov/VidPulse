import { useEffect, useRef, useState } from 'react';

export interface AutoCompleteProps {
  options: { value: string }[] | string[];
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  style?: React.CSSProperties;
}

export function AutoComplete({ options, placeholder, value, onChange, style }: AutoCompleteProps) {
  const list = (options as any[]).map((o) => (typeof o === 'string' ? o : o.value));
  const [q, setQ] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = list.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="kp-dd" ref={ref} style={style}>
      <input
        className="kp-input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onChange?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="kp-dd-menu">
          {filtered.map((o) => (
            <div
              key={o}
              className="kp-dd-opt"
              onClick={() => {
                setQ(o);
                onChange?.(o);
                setOpen(false);
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
