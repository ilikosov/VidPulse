import { useState, type ReactNode } from 'react';
import type {
  ColumnsType,
  TableRowSelection,
  ExpandableConfig,
  TablePaginationConfig,
} from './types';

export interface TableProps<T> {
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey?: string | ((record: T) => string | number);
  pagination?: false | TablePaginationConfig;
  size?: 'small' | 'middle' | 'large';
  loading?: boolean;
  bordered?: boolean;
  showHeader?: boolean;
  rowSelection?: TableRowSelection<T>;
  expandable?: ExpandableConfig<T>;
  scroll?: { x?: number | string; y?: number | string };
  className?: string;
  onChange?: (...args: unknown[]) => void;
  locale?: { emptyText?: ReactNode };
  [key: string]: unknown;
}

function keyOf<T>(row: T, rowKey: TableProps<T>['rowKey'], i: number): string | number {
  if (typeof rowKey === 'function') return rowKey(row);
  const v = (row as Record<string, unknown>)[rowKey ?? 'id'];
  return (v as string | number) ?? i;
}

function Pager({ pagination }: { pagination: TablePaginationConfig }) {
  const { current = 1, pageSize = 20, total = 0, onChange } = pagination;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="kp-pager">
      <button
        className="kp-pager-btn"
        disabled={current <= 1}
        onClick={() => onChange?.(current - 1, pageSize)}
      >
        ‹
      </button>
      <span className="kp-pager-info">
        {current} / {pages}
      </span>
      <button
        className="kp-pager-btn"
        disabled={current >= pages}
        onClick={() => onChange?.(current + 1, pageSize)}
      >
        ›
      </button>
    </div>
  );
}

export function Table<T extends Record<string, any>>({
  columns,
  dataSource,
  rowKey = 'id',
  pagination,
  size,
  loading,
  bordered,
  showHeader = true,
  rowSelection,
  expandable,
  className,
}: TableProps<T>) {
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());

  const selectedKeys = new Set(rowSelection?.selectedRowKeys ?? []);
  const allKeys = dataSource.map((r, i) => keyOf(r, rowKey, i));
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k));

  const toggleAll = () => {
    if (!rowSelection?.onChange) return;
    const next = allSelected ? [] : allKeys;
    rowSelection.onChange(
      next,
      dataSource.filter((r, i) => next.includes(keyOf(r, rowKey, i))),
    );
  };
  const toggleRow = (k: string | number) => {
    if (!rowSelection?.onChange) return;
    const next = selectedKeys.has(k)
      ? [...selectedKeys].filter((x) => x !== k)
      : [...selectedKeys, k];
    rowSelection.onChange(
      next,
      dataSource.filter((r, i) => next.includes(keyOf(r, rowKey, i))),
    );
  };

  const colCount = columns.length + (rowSelection ? 1 : 0) + (expandable ? 1 : 0);

  return (
    <div className={`kp-table-wrap${className ? ' ' + className : ''}`}>
      <table
        className={`kp-table${size === 'small' ? ' kp-table--sm' : ''}${bordered ? ' kp-table--bordered' : ''}`}
      >
        {showHeader && (
          <thead>
            <tr>
              {expandable && <th className="kp-table-x" />}
              {rowSelection && (
                <th className="kp-table-x">
                  {rowSelection.type !== 'radio' && (
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  )}
                </th>
              )}
              {columns.map((c, ci) => (
                <th
                  key={c.key ?? String(c.dataIndex) ?? ci}
                  style={{ textAlign: c.align ?? 'left', width: c.width }}
                >
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {dataSource.length === 0 && (
            <tr>
              <td colSpan={colCount} className="kp-table-empty">
                Нет данных
              </td>
            </tr>
          )}
          {dataSource.map((row, ri) => {
            const rk = keyOf(row, rowKey, ri);
            const canExpand =
              expandable?.rowExpandable?.(row) ?? Boolean(expandable?.expandedRowRender);
            const isExpanded = expanded.has(rk);
            return (
              <>
                <tr key={rk}>
                  {expandable && (
                    <td className="kp-table-x">
                      {canExpand && (
                        <button
                          className="kp-table-expand"
                          onClick={() => {
                            setExpanded((s) => {
                              const n = new Set(s);
                              n.has(rk) ? n.delete(rk) : n.add(rk);
                              return n;
                            });
                            expandable?.onExpand?.(!isExpanded, row);
                          }}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      )}
                    </td>
                  )}
                  {rowSelection && (
                    <td className="kp-table-x">
                      <input
                        type={rowSelection.type === 'radio' ? 'radio' : 'checkbox'}
                        checked={selectedKeys.has(rk)}
                        disabled={rowSelection.getCheckboxProps?.(row)?.disabled}
                        onChange={() => toggleRow(rk)}
                      />
                    </td>
                  )}
                  {columns.map((c, ci) => {
                    const raw = c.dataIndex != null ? (row as any)[c.dataIndex] : undefined;
                    return (
                      <td
                        key={c.key ?? String(c.dataIndex) ?? ci}
                        style={{ textAlign: c.align ?? 'left' }}
                        className={c.ellipsis ? 'kp-td-ellipsis' : undefined}
                      >
                        {c.render ? c.render(raw, row, ri) : (raw as ReactNode)}
                      </td>
                    );
                  })}
                </tr>
                {expandable && isExpanded && expandable.expandedRowRender && (
                  <tr key={`${rk}-x`} className="kp-table-expanded">
                    <td colSpan={colCount}>{expandable.expandedRowRender(row, ri)}</td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {loading && <div className="kp-table-loading">Загрузка…</div>}
      {pagination ? <Pager pagination={pagination} /> : null}
    </div>
  );
}
