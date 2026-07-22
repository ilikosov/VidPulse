import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface SelectOption {
  label?: ReactNode;
  value: string | number;
  disabled?: boolean;
  [key: string]: unknown;
}
export interface SelectProps<VT = any> {
  value?: VT | VT[];
  defaultValue?: VT | VT[];
  onChange?: (value: any, option?: any) => void;
  options?: any[];
  placeholder?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  allowClear?: boolean;
  disabled?: boolean;
  loading?: boolean;
  mode?: 'multiple' | 'tags';
  showSearch?: boolean;
  filterOption?: boolean | ((input: string, option?: SelectOption) => boolean);
  onSearch?: (value: string) => void;
  notFoundContent?: ReactNode;
  size?: 'small' | 'middle' | 'large';
  labelInValue?: boolean;
  popupMatchSelectWidth?: boolean;
  optionFilterProp?: string;
  fieldNames?: { label?: string; value?: string };
  [key: string]: unknown;
}

export function Select<VT = any>({
  value,
  defaultValue,
  onChange,
  options = [],
  placeholder = 'Выбрать…',
  style,
  className,
  allowClear,
  disabled,
  mode,
  showSearch,
  filterOption = true,
  onSearch,
  notFoundContent = 'Нет данных',
}: SelectProps<VT>) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState<any>(value ?? defaultValue);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const current = value !== undefined ? value : inner;
  const multiple = mode === 'multiple' || mode === 'tags';
  const selected: (string | number)[] = multiple ? (Array.isArray(current) ? current : []) : [];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered =
    showSearch && query && filterOption !== false
      ? options.filter((o) =>
          typeof filterOption === 'function'
            ? filterOption(query, o)
            : String(o.label ?? o.value)
                .toLowerCase()
                .includes(query.toLowerCase()),
        )
      : options;

  const pick = (o: SelectOption) => {
    if (multiple) {
      const next = selected.includes(o.value)
        ? selected.filter((v) => v !== o.value)
        : [...selected, o.value];
      setInner(next);
      onChange?.(next, o);
    } else {
      setInner(o.value);
      onChange?.(o.value, o);
      setOpen(false);
    }
    setQuery('');
  };

  const labelFor = (v: string | number) => options.find((o) => o.value === v)?.label ?? v;
  const triggerText = multiple
    ? selected.length
      ? null
      : placeholder
    : current != null && current !== ''
      ? labelFor(current)
      : placeholder;

  return (
    <div
      className={`kp-dd${open ? ' open' : ''}${disabled ? ' disabled' : ''}${className ? ' ' + className : ''}`}
      ref={ref}
      style={style}
    >
      <div className="kp-input kp-dd-trigger" onClick={() => !disabled && setOpen((o) => !o)}>
        {multiple && selected.length > 0 ? (
          <span className="kp-dd-tags">
            {selected.map((v) => (
              <span className="kp-tag" key={String(v)}>
                {labelFor(v)}
              </span>
            ))}
          </span>
        ) : (
          <span className={current == null || current === '' ? 'kp-txt-faint' : undefined}>
            {triggerText}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {allowClear && current != null && current !== '' && (
            <span
              className="kp-dd-clear"
              onClick={(e) => {
                e.stopPropagation();
                const empty = multiple ? [] : undefined;
                setInner(empty);
                onChange?.(empty);
              }}
            >
              ×
            </span>
          )}
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
        </span>
      </div>
      {open && (
        <div className="kp-dd-menu">
          {showSearch && (
            <input
              className="kp-input kp-dd-search"
              autoFocus
              value={query}
              placeholder="Поиск…"
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
            />
          )}
          {filtered.length === 0 && <div className="kp-dd-empty">{notFoundContent}</div>}
          {filtered.map((o) => {
            const isSel = multiple ? selected.includes(o.value) : o.value === current;
            return (
              <div
                key={String(o.value)}
                className={`kp-dd-opt${isSel ? ' sel' : ''}${o.disabled ? ' disabled' : ''}`}
                onClick={() => !o.disabled && pick(o)}
              >
                {o.label ?? String(o.value)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
