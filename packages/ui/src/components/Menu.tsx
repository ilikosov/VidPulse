import type { ReactNode, CSSProperties } from 'react';

export interface MenuItem {
  key: string;
  icon?: ReactNode;
  label?: ReactNode;
  type?: 'divider' | 'group';
  disabled?: boolean;
  onClick?: () => void;
  children?: MenuItem[];
}
export interface MenuProps {
  items: MenuItem[];
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelect?: (e: { key: string }) => void;
  onClick?: (e: { key: string }) => void;
  mode?: 'inline' | 'horizontal' | 'vertical';
  theme?: 'light' | 'dark';
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
}

export function Menu({
  items,
  selectedKeys = [],
  onSelect,
  onClick,
  mode = 'inline',
  style,
  className,
}: MenuProps) {
  const cls = mode === 'horizontal' ? 'kp-menu kp-menu--h' : 'kp-col kp-menu kp-menu--v';
  return (
    <div className={`${cls}${className ? ' ' + className : ''}`} style={{ gap: 2, ...style }}>
      {items.map((it) =>
        it.type === 'divider' ? (
          <hr key={it.key} className="kp-divider" style={{ margin: '8px 0' }} />
        ) : (
          <div
            key={it.key}
            className={`kp-menu-item${selectedKeys.includes(it.key) ? ' active' : ''}${it.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (it.disabled) return;
              it.onClick?.();
              onClick?.({ key: it.key });
              onSelect?.({ key: it.key });
            }}
          >
            {it.icon}
            <span>{it.label}</span>
          </div>
        ),
      )}
    </div>
  );
}
