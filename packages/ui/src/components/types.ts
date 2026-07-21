import type { ReactNode } from 'react';

export interface ColumnsType<T = any> extends Array<{
  title: ReactNode;
  dataIndex?: keyof T;
  key?: string;
  align?: 'left' | 'right' | 'center';
  render?: (value: any, record: T) => ReactNode;
}> {}

export interface TableRowSelection<T> {
  selectedRowKeys?: (string | number)[];
  onChange?: (keys: (string | number)[], rows: T[]) => void;
}

export interface UploadFile {
  uid: string;
  name: string;
  status?: 'uploading' | 'done' | 'error';
  url?: string;
}
