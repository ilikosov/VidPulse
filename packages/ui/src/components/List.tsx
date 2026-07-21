import type { ReactNode } from 'react';

export interface ListItemData {
  avatar?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
}
export interface ListProps {
  dataSource: ListItemData[];
  renderItem?: (item: ListItemData) => ReactNode;
}

export function List({ dataSource, renderItem }: ListProps) {
  return (
    <div>
      {dataSource.map((it, i) =>
        renderItem ? (
          <div key={i}>{renderItem(it)}</div>
        ) : (
          <div className="kp-list-item" key={i}>
            {it.avatar}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kp-list-title">{it.title}</div>
              {it.sub && <div className="kp-list-sub">{it.sub}</div>}
            </div>
            {it.extra}
          </div>
        ),
      )}
    </div>
  );
}
