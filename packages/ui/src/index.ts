// @vidpulse/ui is the app's component library and the single antd boundary. It declares the exact
// set of Ant Design components it provides — the app imports these from @vidpulse/ui, never from antd.
// ./wrappers holds components implemented (as thin wrappers) by the kit; the rest are re-exported
// as-is below. Components in ./wrappers are NOT repeated here (that would be a duplicate export).
export * from './wrappers';

export {
  Alert,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Image,
  Layout,
  List,
  Menu,
  Popconfirm,
  Row,
  Spin,
  Switch,
  Table,
  Tabs,
  Tooltip,
  Upload,
  notification,
} from 'antd';
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
