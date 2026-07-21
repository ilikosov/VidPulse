import { useState, type ReactNode } from 'react';

export interface CollapseItem {
  key: string;
  label: ReactNode;
  children: ReactNode;
}
export interface CollapseProps {
  items: CollapseItem[];
  defaultActiveKey?: string[];
}

export function Collapse({ items, defaultActiveKey = [] }: CollapseProps) {
  const [openKeys, setOpenKeys] = useState<string[]>(defaultActiveKey);
  const toggle = (k: string) =>
    setOpenKeys((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  return (
    <div>
      {items.map((it) => (
        <div key={it.key} className={`kp-collapse-item${openKeys.includes(it.key) ? ' open' : ''}`}>
          <div className="kp-collapse-head" onClick={() => toggle(it.key)}>
            <span>{it.label}</span>
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
          {openKeys.includes(it.key) && <div className="kp-collapse-body">{it.children}</div>}
        </div>
      ))}
    </div>
  );
}
