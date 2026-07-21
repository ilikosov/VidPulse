// The Ant Design components @vidpulse/ui re-exports as-is. Together with the kit's own components
// (./wrappers, ./StatusBadge, …) this is the ONLY place antd is imported — the app (and
// @vidpulse/monitor) depend on @vidpulse/ui, never on antd directly. Components implemented as
// wrappers in ./wrappers (Input, Modal, Segmented, Select, Space, Tag, Typography, message) are NOT
// re-exported here to avoid a duplicate export. Keep this list in sync with what the app uses.
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
