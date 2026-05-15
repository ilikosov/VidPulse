import {
  Alert,
  Button,
  Card,
  Divider,
  List,
  Modal,
  Space,
  Typography,
  Upload,
  notification,
} from 'antd';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { dictionaryApi } from '../api/dictionary';

export default function DictionaryToolsPage() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [summary, setSummary] = useState<{
    inserted: number;
    updated: number;
    errors?: string[];
  } | null>(null);

  const templateEntities = ['groups', 'artists', 'songs', 'events'] as const;
  const templateFormats = ['csv', 'json'] as const;
  const templateLabelMap: Record<string, string> = {
    groups: 'Groups',
    artists: 'Artists',
    songs: 'Songs',
    events: 'Events / Locations',
  };
  const templateUrl = (entity: string, format: string) =>
    `${(import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api'}/dictionary/template/${entity}/${format}`;

  const entityLinks = useMemo(
    () => [
      { to: '/dictionary/groups', label: 'Groups' },
      { to: '/dictionary/artists', label: 'Artists' },
      { to: '/dictionary/songs', label: 'Songs' },
      { to: '/dictionary/events', label: 'Events / Locations' },
    ],
    [],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Dictionary Tools
      </Typography.Title>

      <Card title="Import from File">
        <Space direction="vertical">
          <Typography.Text>Upload CSV/JSON dictionary data.</Typography.Text>
          <Button type="primary" onClick={() => setImportModalOpen(true)}>
            Import from File
          </Button>
        </Space>
      </Card>

      <Card title="Download Templates">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {templateFormats.map((format) => (
            <Space key={format} wrap>
              {templateEntities.map((entity) => (
                <Button
                  key={`${entity}-${format}`}
                  type="link"
                  href={templateUrl(entity, format)}
                  download
                >
                  {`${templateLabelMap[entity]} (${format.toUpperCase()})`}
                </Button>
              ))}
            </Space>
          ))}
        </Space>
      </Card>

      <Card title="Import Summary">
        {summary ? (
          <Space direction="vertical">
            <Typography.Text>{`Inserted: ${summary.inserted}`}</Typography.Text>
            <Typography.Text>{`Updated: ${summary.updated}`}</Typography.Text>
            <Typography.Text>{`Errors: ${summary.errors?.length || 0}`}</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">No imports executed in this session.</Typography.Text>
        )}
      </Card>

      <Card title="Quick Links to Entity Tabs">
        <List
          dataSource={entityLinks}
          renderItem={(item) => (
            <List.Item>
              <Link to={item.to}>{item.label}</Link>
            </List.Item>
          )}
        />
      </Card>

      <Card title="Bulk Import Aliases">
        <Alert
          type="info"
          showIcon
          message="Coming soon"
          description="Bulk aliases import workflow will be available in this section."
        />
      </Card>

      <Card title="Parser Unmatched Values Report">
        <Alert
          type="warning"
          showIcon
          message="Coming soon"
          description="Unmatched parser values report will be added here."
        />
      </Card>

      <Card title="Dictionary Health Check">
        <Alert
          type="info"
          showIcon
          message="Coming soon"
          description="Dictionary health diagnostics and consistency checks will be added here."
        />
      </Card>

      <Modal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        title="Import Dictionary"
      >
        <Divider style={{ marginTop: 0 }} />
        <Upload
          showUploadList={false}
          beforeUpload={async (file) => {
            try {
              const result: any = await dictionaryApi.importFile(file as File);
              setSummary({
                inserted: result.inserted || 0,
                updated: result.updated || 0,
                errors: result.errors || [],
              });
              notification.success({
                message: `Imported: ${result.inserted} inserted, ${result.updated} updated`,
              });
              setImportModalOpen(false);
            } catch (error: any) {
              notification.error({ message: error.message || 'Import failed' });
            }
            return false;
          }}
        >
          <Button type="primary">Select File to Import</Button>
        </Upload>
      </Modal>
    </Space>
  );
}
