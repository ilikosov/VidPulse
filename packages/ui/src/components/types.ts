// Ant Design sub-path types the app consumes. Re-exported from @vidpulse/ui so the app never imports
// from antd directly. Replace these with the kit's own types on migration.
export type { ColumnsType } from 'antd/es/table';
export type { TableRowSelection } from 'antd/es/table/interface';
export type { UploadFile } from 'antd/es/upload/interface';
