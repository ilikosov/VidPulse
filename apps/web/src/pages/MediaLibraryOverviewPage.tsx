import { Alert, Typography } from 'antd';

export default function MediaLibraryOverviewPage() {
  return (
    <>
      <Typography.Title level={3}>Media Library Overview</Typography.Title>
      <Alert type="info" showIcon message="Use tabs to navigate dictionary entities and tools." />
    </>
  );
}
