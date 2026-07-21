// @vidpulse/ui is the single UI dependency boundary: the rest of the app imports antd through here,
// never directly. Re-export the antd surface (components + message/notification + types) plus the
// sub-path table/upload types the app uses.
export * from 'antd';
export type { ColumnsType } from 'antd/es/table';
export type { TableRowSelection } from 'antd/es/table/interface';
export type { UploadFile } from 'antd/es/upload/interface';

export { formatDuration } from './formatDuration';

export { default as OperationLogWidget } from './OperationLogWidget';
export type { OperationLogWidgetProps } from './OperationLogWidget';

export { createDrawerProvider } from './createDrawerProvider';
export type {
  CreateDrawerProviderConfig,
  DrawerProvider,
  DrawerChrome,
} from './createDrawerProvider';

export { StatusBadge, DEFAULT_STATUS_COLORS } from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';
