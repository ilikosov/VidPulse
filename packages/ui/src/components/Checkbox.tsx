import type { ReactNode, ChangeEvent } from 'react';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  children?: ReactNode;
}

export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className="kp-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
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

function Group({
  options,
  defaultValue,
  onChange,
}: {
  options: string[];
  defaultValue?: string[];
  onChange?: (v: string[]) => void;
}) {
  return (
    <div className="kp-row">
      {options.map((o) => (
        <Checkbox key={o} checked={defaultValue?.includes(o)} onChange={() => {}}>
          {o}
        </Checkbox>
      ))}
    </div>
  );
}
Checkbox.Group = Group;
