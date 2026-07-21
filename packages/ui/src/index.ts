// @vidpulse/ui is the app's component library and the single antd boundary. It declares the exact
// set of Ant Design components it provides (see ./antd) — the app imports these from @vidpulse/ui,
// never from antd.
export * from './antd';

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
