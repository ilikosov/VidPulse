import { Card, Typography } from 'antd';

export default function EventDictionaryPage() {
  return (
    <Card>
      <Typography.Title level={4}>Events / Locations</Typography.Title>
      <Typography.Paragraph>
        @todo(2026-05-14): Move Events/Locations dictionary CRUD into a dedicated page.
      </Typography.Paragraph>
      <Typography.Paragraph>
        Use Import / Tools for bulk updates until the dedicated dictionary UI is implemented.
      </Typography.Paragraph>
    </Card>
  );
}
