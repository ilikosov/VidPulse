// @vidpulse/ui is the app's component library and the single antd boundary — the app (and
// @vidpulse/monitor) import components from here, never from antd. Each Ant Design component lives in
// its own file under ./components (a thin wrapper over antd today, the migration seam for a custom
// design tomorrow); the kit's own components/utilities are exported below.
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
