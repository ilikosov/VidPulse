import type { ColumnsType } from './types';

export interface TableProps<T> {
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey?: string;
  pagination?: false | Record<string, unknown>;
  size?: 'small' | 'middle' | 'large';
}

export function Table<T extends Record<string, any>>({
  columns,
  dataSource,
  rowKey = 'id',
}: TableProps<T>) {
  return (
    <div className="kp-table-wrap">
      <table className="kp-table">
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.key ?? c.dataIndex} style={{ textAlign: c.align ?? 'left' }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((c: any) => (
                <td key={c.key ?? c.dataIndex} style={{ textAlign: c.align ?? 'left' }}>
                  {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
