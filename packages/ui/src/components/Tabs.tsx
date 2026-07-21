import { useState, type ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: ReactNode;
  children?: ReactNode;
}
export interface TabsProps {
  items: TabItem[];
  defaultActiveKey?: string;
  activeKey?: string;
  onChange?: (k: string) => void;
}

export function Tabs({ items, defaultActiveKey, activeKey, onChange }: TabsProps) {
  const [sel, setSel] = useState(activeKey ?? defaultActiveKey ?? items[0]?.key);
  const current = activeKey ?? sel;
  const set = (k: string) => {
    setSel(k);
    onChange?.(k);
  };
  const active = items.find((it) => it.key === current);
  return (
    <div>
      <div className="kp-tabs-bar">
        {items.map((it) => (
          <button
            key={it.key}
            className={current === it.key ? 'active' : ''}
            onClick={() => set(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {active?.children && <div style={{ paddingTop: 16 }}>{active.children}</div>}
    </div>
  );
}
