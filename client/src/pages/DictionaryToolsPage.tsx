import { Alert, Button, Card, Input, Modal, Space, Typography, Upload, notification } from 'antd';
import { useState } from 'react';
import { dictionaryApi } from '../api/dictionary';

type ImportSummary = {
  mode: string;
  groups: { inserted: number; updated: number; aliasesInserted: number };
  artists: {
    inserted: number;
    updated: number;
    aliasesInserted: number;
    membershipsInserted: number;
  };
  songs: {
    inserted: number;
    updated: number;
    aliasesInserted: number;
    artistLinksInserted: number;
    groupLinksInserted: number;
  };
  events: { inserted: number; updated: number; aliasesInserted: number };
  errors: string[];
};

const emptySummary = (): ImportSummary => ({
  mode: 'merge',
  groups: { inserted: 0, updated: 0, aliasesInserted: 0 },
  artists: { inserted: 0, updated: 0, aliasesInserted: 0, membershipsInserted: 0 },
  songs: {
    inserted: 0,
    updated: 0,
    aliasesInserted: 0,
    artistLinksInserted: 0,
    groupLinksInserted: 0,
  },
  events: { inserted: 0, updated: 0, aliasesInserted: 0 },
  errors: [],
});

const normalizeImportSummary = (value: unknown): ImportSummary | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!record.groups || !record.artists || !record.songs || !record.events) return null;

  const defaults = emptySummary();
  return {
    mode: typeof record.mode === 'string' ? record.mode : defaults.mode,
    groups: { ...defaults.groups, ...(record.groups as Partial<ImportSummary['groups']>) },
    artists: { ...defaults.artists, ...(record.artists as Partial<ImportSummary['artists']>) },
    songs: { ...defaults.songs, ...(record.songs as Partial<ImportSummary['songs']>) },
    events: { ...defaults.events, ...(record.events as Partial<ImportSummary['events']>) },
    errors: Array.isArray(record.errors) ? (record.errors as string[]) : [],
  };
};

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export default function DictionaryToolsPage() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const dangerousActionsEnabled =
    (import.meta as any).env?.VITE_MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED === 'true';

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearConfirmValue, setClearConfirmValue] = useState('');

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Media Library Tools
      </Typography.Title>

      <Card title="Import Media Library JSON">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>Only hierarchical Media Library JSON is supported.</Typography.Text>
          <Typography.Text>
            Songs must be nested under a group, artist, or solo artist.
          </Typography.Text>
          <Typography.Text>
            Merge mode adds or updates data and never deletes missing entities.
          </Typography.Text>
          <Button type="primary" onClick={() => setImportModalOpen(true)}>
            Import Media Library JSON
          </Button>
        </Space>
      </Card>

      <Card title="Downloads">
        <Space wrap>
          <Button type="link" href={`${API_BASE}/dictionary/schema`} download>
            Download JSON Schema
          </Button>
          <Button type="link" href={`${API_BASE}/dictionary/example`} download>
            Download Example JSON
          </Button>
          <Button type="link" href={`${API_BASE}/dictionary/export`} download>
            Export Media Library JSON
          </Button>
        </Space>
      </Card>

      <Card title="Import Result">
        {summary ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text strong>{`Mode: ${summary.mode}`}</Typography.Text>
            <Typography.Text>{`Groups: inserted=${summary.groups.inserted}, updated=${summary.groups.updated}, aliases=${summary.groups.aliasesInserted}`}</Typography.Text>
            <Typography.Text>{`Artists: inserted=${summary.artists.inserted}, updated=${summary.artists.updated}, aliases=${summary.artists.aliasesInserted}, memberships=${summary.artists.membershipsInserted}`}</Typography.Text>
            <Typography.Text>{`Songs: inserted=${summary.songs.inserted}, updated=${summary.songs.updated}, aliases=${summary.songs.aliasesInserted}, artistLinks=${summary.songs.artistLinksInserted}, groupLinks=${summary.songs.groupLinksInserted}`}</Typography.Text>
            <Typography.Text>{`Events: inserted=${summary.events.inserted}, updated=${summary.events.updated}, aliases=${summary.events.aliasesInserted}`}</Typography.Text>
            <Typography.Text>{`Errors: ${summary.errors.length}`}</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">No imports executed in this session.</Typography.Text>
        )}
      </Card>

      {dangerousActionsEnabled ? (
        <Card title="Dangerous Actions">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="Replace mode is dangerous and requires dangerous actions to be enabled."
            />
            <Button danger onClick={() => setClearModalOpen(true)}>
              Clear Media Library
            </Button>
          </Space>
        </Card>
      ) : null}

      <Modal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        title="Import Media Library JSON"
      >
        <Upload
          showUploadList={false}
          accept=".json,application/json"
          beforeUpload={async (file) => {
            try {
              const rawText = await file.text();
              try {
                const parsed = JSON.parse(rawText);
                if (parsed?.mode === 'replace') {
                  notification.warning({
                    message:
                      'Replace mode is dangerous and requires dangerous actions to be enabled.',
                  });
                }
              } catch {
                // backend validation handles malformed JSON
              }

              const result = await dictionaryApi.importFile(file as File);
              const normalized = normalizeImportSummary(result);

              if (normalized !== null) {
                setSummary(normalized);
                notification.success({ message: 'Media library import completed' });
              } else if (
                result &&
                typeof result === 'object' &&
                'jobId' in result &&
                typeof (result as { jobId?: unknown }).jobId === 'string'
              ) {
                const jobId = (result as { jobId: string }).jobId;
                notification.success({ message: 'Media library import started' });

                const pollImportProgress = async () => {
                  try {
                    const progress = await dictionaryApi.getImportProgress(jobId);
                    if (!progress || typeof progress !== 'object') return;

                    const status = (progress as { status?: unknown }).status;
                    if (status === 'completed') {
                      const progressSummary = normalizeImportSummary(
                        (progress as { summary?: unknown }).summary,
                      );
                      if (progressSummary) {
                        setSummary(progressSummary);
                        notification.success({ message: 'Media library import completed' });
                      } else {
                        notification.warning({
                          message: 'Import response did not include summary',
                        });
                      }
                      return;
                    }

                    if (status === 'failed') {
                      notification.error({ message: 'Media library import failed' });
                      return;
                    }

                    window.setTimeout(pollImportProgress, 1500);
                  } catch {
                    notification.error({ message: 'Failed to fetch import progress' });
                  }
                };

                window.setTimeout(pollImportProgress, 1500);
              } else {
                notification.warning({ message: 'Import response did not include summary' });
              }
              setImportModalOpen(false);
            } catch (error: any) {
              notification.error({ message: error.message || 'Import failed' });
            }
            return false;
          }}
        >
          <Button type="primary">Select JSON File</Button>
        </Upload>
      </Modal>

      <Modal
        open={clearModalOpen}
        onCancel={() => {
          setClearModalOpen(false);
          setClearConfirmValue('');
        }}
        onOk={async () => {
          try {
            await dictionaryApi.clearMediaLibrary();
            notification.success({ message: 'Media library cleared' });
            setClearModalOpen(false);
            setClearConfirmValue('');
          } catch (error: any) {
            notification.error({ message: error.message || 'Clear failed' });
          }
        }}
        okButtonProps={{ danger: true, disabled: clearConfirmValue !== 'CLEAR' }}
        okText="Clear"
        title="Clear media library?"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            This will delete all groups, artists, songs, events, aliases and media-library links.
            Videos will not be deleted.
          </Typography.Text>
          <Typography.Text>Type CLEAR to confirm:</Typography.Text>
          <Input value={clearConfirmValue} onChange={(e) => setClearConfirmValue(e.target.value)} />
        </Space>
      </Modal>
    </Space>
  );
}
