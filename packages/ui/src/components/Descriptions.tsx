import type { ReactNode, CSSProperties } from 'react';

interface DescriptionsItemProps {
  label?: ReactNode;
  span?: number;
  children?: ReactNode;
  [key: string]: unknown;
}
function Item({ label, children }: DescriptionsItemProps) {
  return (
    <div className="kp-drow">
      <span className="kp-drow-label">{label}</span>
      <span className="kp-drow-val">{children}</span>
    </div>
  );
}

interface DescriptionsProps {
  // antd children API (<Descriptions.Item>) — preferred by the app
  children?: ReactNode;
  // legacy items-prop API
  items?: {
    key?: string | number;
    label?: ReactNode;
    value?: ReactNode;
    children?: ReactNode;
    span?: number;
    [k: string]: unknown;
  }[];
  title?: ReactNode;
  column?: number | Record<string, number>;
  size?: 'small' | 'middle' | 'default';
  bordered?: boolean;
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
}

function DescriptionsBase({
  children,
  items,
  title,
  bordered,
  style,
  className,
}: DescriptionsProps) {
  return (
    <div
      className={`kp-desc${bordered ? ' kp-desc--bordered' : ''}${className ? ' ' + className : ''}`}
      style={style}
    >
      {title && <div className="kp-desc-title">{title}</div>}
      {items
        ? items.map((it, i) => (
            <div className="kp-drow" key={i}>
              <span className="kp-drow-label">{it.label}</span>
              <span className="kp-drow-val">{it.value ?? it.children}</span>
            </div>
          ))
        : children}
    </div>
  );
}

export const Descriptions = Object.assign(DescriptionsBase, { Item });
