import type { ReactNode } from 'react';

export interface MenuItem {
  key: string;
  icon?: ReactNode;
  label?: ReactNode;
  type?: 'divider';
}
export interface MenuProps {
  items: MenuItem[];
  selectedKeys?: string[];
  onSelect?: (e: { key: string }) => void;
  mode?: 'inline';
  style?: React.CSSProperties;
}

export function Menu({ items, selectedKeys = [], onSelect, style }: MenuProps) {
  return (
    <div className="kp-col" style={{ gap: 2, ...style }}>
      {items.map((it) =>
        it.type === 'divider' ? (
          <hr key={it.key} className="kp-divider" style={{ margin: '8px 0' }} />
        ) : (
          <div
            key={it.key}
            className={`kp-menu-item${selectedKeys.includes(it.key) ? ' active' : ''}`}
            onClick={() => onSelect?.({ key: it.key })}
          >
            {it.icon}
            <span>{it.label}</span>
          </div>
        ),
      )}
    </div>
  );
}
