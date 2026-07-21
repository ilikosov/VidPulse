// @vidpulse/ui — the app's component library and single UI boundary. Custom kit: no antd
// dependency anywhere in this package. Each component lives in its own file under ./components.
export * from './components';

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
