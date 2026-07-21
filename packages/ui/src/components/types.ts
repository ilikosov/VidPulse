import type { CSSProperties, ReactNode } from 'react';

export interface ColumnType<T = any> {
  title?: ReactNode;
  dataIndex?: keyof T | string;
  key?: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  ellipsis?: boolean;
  fixed?: 'left' | 'right' | boolean;
  className?: string;
  onCell?: (record: T, index?: number) => Record<string, unknown>;
  sorter?: unknown;
  render?: (value: any, record: T, index: number) => ReactNode;
  // Migration bridge: tolerate any extra antd column option the app still passes.
  [key: string]: unknown;
}

export type ColumnsType<T = any> = ColumnType<T>[];

export interface TableRowSelection<T = any> {
  type?: 'checkbox' | 'radio';
  selectedRowKeys?: (string | number)[];
  onChange?: (keys: (string | number)[], rows: T[]) => void;
  getCheckboxProps?: (record: T) => { disabled?: boolean };
  columnWidth?: number | string;
}

export interface ExpandableConfig<T = any> {
  rowExpandable?: (record: T) => boolean;
  expandedRowRender?: (record: T, index: number) => ReactNode;
  expandedRowKeys?: (string | number)[];
  defaultExpandedRowKeys?: (string | number)[];
  onExpand?: (expanded: boolean, record: T) => void;
  columnWidth?: number | string;
}

export interface TablePaginationConfig {
  current?: number;
  pageSize?: number;
  total?: number;
  showSizeChanger?: boolean;
  pageSizeOptions?: (string | number)[];
  showTotal?: (total: number, range: [number, number]) => ReactNode;
  size?: 'small' | 'default';
  onChange?: (page: number, pageSize: number) => void;
  position?: string[];
  [key: string]: unknown;
}

export interface UploadFile {
  uid: string;
  name: string;
  status?: 'uploading' | 'done' | 'error';
  url?: string;
  originFileObj?: File;
  size?: number;
  type?: string;
}

export type { CSSProperties };
