import type { ReactNode, CSSProperties } from 'react';
import type { TablePaginationConfig } from './types';

interface ItemProps {
  actions?: ReactNode[];
  extra?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}
function Item({ actions, extra, children, className, style }: ItemProps) {
  return (
    <div className={`kp-list-item${className ? ' ' + className : ''}`} style={style}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {actions && actions.length > 0 && <div className="kp-list-actions">{actions}</div>}
      {extra}
    </div>
  );
}
function Meta({
  avatar,
  title,
  description,
}: {
  avatar?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="kp-list-meta">
      {avatar}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="kp-list-title">{title}</div>}
        {description && <div className="kp-list-sub">{description}</div>}
      </div>
    </div>
  );
}
Item.Meta = Meta;

export interface ListProps<T = any> {
  dataSource?: T[];
  renderItem?: (item: T, index: number) => ReactNode;
  rowKey?: string | ((item: T) => string | number);
  header?: ReactNode;
  footer?: ReactNode;
  bordered?: boolean;
  size?: 'small' | 'default' | 'large';
  itemLayout?: 'horizontal' | 'vertical';
  grid?: unknown;
  loading?: boolean;
  locale?: { emptyText?: ReactNode };
  pagination?: false | TablePaginationConfig;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}

function ListBase<T>({
  dataSource = [],
  renderItem,
  header,
  footer,
  bordered,
  locale,
  pagination,
  className,
  style,
}: ListProps<T>) {
  const p = pagination ? pagination : null;
  const pages = p ? Math.max(1, Math.ceil((p.total ?? 0) / (p.pageSize ?? 20))) : 1;
  return (
    <div
      className={`kp-list${bordered ? ' kp-list--bordered' : ''}${className ? ' ' + className : ''}`}
      style={style}
    >
      {header && <div className="kp-list-header">{header}</div>}
      {dataSource.length === 0 && (
        <div className="kp-list-empty">{locale?.emptyText ?? 'Ничего не найдено'}</div>
      )}
      {dataSource.map((it, i) => (
        <div key={i}>{renderItem ? renderItem(it, i) : null}</div>
      ))}
      {footer && <div className="kp-list-footer">{footer}</div>}
      {p && pages > 1 && (
        <div className="kp-pager">
          <button
            className="kp-pager-btn"
            disabled={(p.current ?? 1) <= 1}
            onClick={() => p.onChange?.((p.current ?? 1) - 1, p.pageSize ?? 20)}
          >
            ‹
          </button>
          <span className="kp-pager-info">
            {p.current ?? 1} / {pages}
          </span>
          <button
            className="kp-pager-btn"
            disabled={(p.current ?? 1) >= pages}
            onClick={() => p.onChange?.((p.current ?? 1) + 1, p.pageSize ?? 20)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export const List = Object.assign(ListBase, { Item });
