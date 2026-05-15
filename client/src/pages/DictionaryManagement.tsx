import { Alert, Button, Input, Modal, Space, Typography, Upload, notification } from 'antd';
import { useState } from 'react';
import { dictionaryApi } from '../api/dictionary';

export default function DictionaryManagement() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearConfirmValue, setClearConfirmValue] = useState('');
  const [clearing, setClearing] = useState(false);

  const dangerousActionsEnabled =
    (import.meta as any).env?.VITE_MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED === 'true';

  const templateEntities = ['groups', 'artists', 'songs', 'events'] as const;
  const templateFormats = ['csv', 'json'] as const;
  const templateLabelMap: Record<string, string> = {
    groups: 'Groups',
    artists: 'Artists',
    songs: 'Songs',
    events: 'Events',
  };
  const templateUrl = (entity: string, format: string) =>
    `${(import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api'}/dictionary/template/${entity}/${format}`;

  const handleClearMediaLibrary = async () => {
    try {
      setClearing(true);
      const response: any = await dictionaryApi.clearMediaLibrary();
      notification.success({
        message: 'Media library cleared successfully',
        description:
          typeof response?.videosUpdated === 'number'
            ? `Videos updated: ${response.videosUpdated}`
            : undefined,
      });
      setClearModalOpen(false);
      setClearConfirmValue('');
    } catch (error: any) {
      notification.error({ message: error.message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Import / Tools
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Use this tab for import/export tools.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          @todo(2026-05-14): keep CRUD only in dedicated dictionary tabs and extend tooling here.
        </Typography.Paragraph>
        <Button type="primary" onClick={() => setImportModalOpen(true)}>
          Import from File
        </Button>

        {dangerousActionsEnabled ? (
          <Alert
            type="warning"
            message="Dangerous actions are enabled"
            description={
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Typography.Text>
                  This will clear groups, artists, songs, events, aliases and media-library links.
                  Videos will not be deleted.
                </Typography.Text>
                <Button danger onClick={() => setClearModalOpen(true)}>
                  Clear Media Library
                </Button>
              </Space>
            }
            showIcon
          />
        ) : (
          <Typography.Text type="secondary">Dangerous actions are disabled.</Typography.Text>
        )}
      </Space>

      <Modal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        title="Import Dictionary"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Upload
            showUploadList={false}
            beforeUpload={async (file) => {
              try {
                const r: any = await dictionaryApi.importFile(file as File);
                notification.success({
                  message: `Imported: ${r.inserted} inserted, ${r.updated} updated`,
                });
                setImportModalOpen(false);
              } catch (e: any) {
                notification.error({ message: e.message });
              }
              return false;
            }}
          >
            <Button type="primary">Select File to Import</Button>
          </Upload>
          <div>
            <strong>Download templates:</strong>
            <Space direction="vertical" size={8} style={{ marginTop: 8, width: '100%' }}>
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
          </div>
        </Space>
      </Modal>

      <Modal
        open={clearModalOpen}
        title="Clear Media Library"
        okText="Clear"
        okButtonProps={{ danger: true, disabled: clearConfirmValue !== 'CLEAR', loading: clearing }}
        cancelButtonProps={{ disabled: clearing }}
        onCancel={() => {
          if (!clearing) {
            setClearModalOpen(false);
            setClearConfirmValue('');
          }
        }}
        onOk={handleClearMediaLibrary}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text>
            This will clear groups, artists, songs, events, aliases and media-library links. Videos
            will not be deleted.
          </Typography.Text>
          <Typography.Text type="secondary">Type CLEAR to confirm.</Typography.Text>
          <Input
            value={clearConfirmValue}
            onChange={(event) => setClearConfirmValue(event.target.value)}
            placeholder="CLEAR"
            disabled={clearing}
          />
        </Space>
      </Modal>
    </>
  );
}
