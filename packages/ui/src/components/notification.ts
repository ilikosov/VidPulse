// notification is antd's imperative API object (notification.error/…). It isn't a React component,
// so it's re-exported rather than wrapped; @vidpulse/ui still owns the export. Replace on migration.
export { notification } from 'antd';
