// The Ant Design components @vidpulse/ui exposes to the app. Together with the kit's own components
// this is the ONLY place antd is imported — the app (and @vidpulse/monitor) depend on @vidpulse/ui,
// never on antd directly. Keep this list in sync with what the app actually uses.
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
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
  notification,
} from 'antd';

export type { ColumnsType } from 'antd/es/table';
export type { TableRowSelection } from 'antd/es/table/interface';
export type { UploadFile } from 'antd/es/upload/interface';
