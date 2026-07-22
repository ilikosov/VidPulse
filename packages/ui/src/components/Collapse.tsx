import { useState, type ReactNode } from 'react';

export interface CollapseItem {
  key: string;
  label: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}
export interface CollapseProps {
  items: CollapseItem[];
  defaultActiveKey?: string[] | string;
  activeKey?: string[] | string;
  onChange?: (key: string[] | string) => void;
  size?: 'small' | 'middle' | 'large';
  ghost?: boolean;
  bordered?: boolean;
  accordion?: boolean;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

export function Collapse({
  items,
  defaultActiveKey = [],
  activeKey,
  onChange,
  className,
  style,
}: CollapseProps) {
  const norm = (k: string[] | string | undefined): string[] =>
    k == null ? [] : Array.isArray(k) ? k : [k];
  const [openKeys, setOpenKeys] = useState<string[]>(norm(defaultActiveKey));
  const current = activeKey != null ? norm(activeKey) : openKeys;
  const toggle = (k: string) => {
    const next = current.includes(k) ? current.filter((x) => x !== k) : [...current, k];
    setOpenKeys(next);
    onChange?.(next);
  };
  return (
    <div className={className} style={style}>
      {items.map((it) => (
        <div key={it.key} className={`kp-collapse-item${current.includes(it.key) ? ' open' : ''}`}>
          <div className="kp-collapse-head" onClick={() => toggle(it.key)}>
            <span>{it.label}</span>
            {it.extra}
            <svg
              viewBox="0 0 24 24"
              width={15}
              height={15}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8l7 8 7-8" />
            </svg>
          </div>
          {current.includes(it.key) && <div className="kp-collapse-body">{it.children}</div>}
        </div>
      ))}
    </div>
  );
}
