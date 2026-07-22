import type { ReactNode, ChangeEvent } from 'react';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Checkbox({
  checked,
  defaultChecked,
  disabled,
  onChange,
  className,
  style,
  children,
}: CheckboxProps) {
  return (
    <label className={`kp-check${className ? ' ' + className : ''}`} style={style}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="kp-check-box">
        <svg
          viewBox="0 0 24 24"
          width={13}
          height={13}
          stroke="currentColor"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      {children}
    </label>
  );
}

type GroupOption = string | { label: ReactNode; value: string; disabled?: boolean };
interface GroupProps {
  options: GroupOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (v: string[]) => void;
  [key: string]: unknown;
}
function Group({ options, value, defaultValue, onChange }: GroupProps) {
  const current = value ?? defaultValue ?? [];
  const opts = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));
  return (
    <div className="kp-row" style={{ flexWrap: 'wrap', gap: 8 }}>
      {opts.map((o) => (
        <Checkbox
          key={o.value}
          checked={current.includes(o.value)}
          onChange={(e) => {
            const next = e.target.checked
              ? [...current, o.value]
              : current.filter((x) => x !== o.value);
            onChange?.(next);
          }}
        >
          {o.label}
        </Checkbox>
      ))}
    </div>
  );
}

Checkbox.Group = Group;
