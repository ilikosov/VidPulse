import { Alert, Button, Card, Input, Modal, Space, Typography, Upload, notification } from 'antd';
import { useState } from 'react';
import { apiUrl, toErrorMessage } from '../api/client';
import { dictionaryApi } from '../api/dictionary';
import { useServerConfig } from '../serverConfigContext';

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

export default function DictionaryToolsPage() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const { dangerousActionsEnabled } = useServerConfig();

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearConfirmValue, setClearConfirmValue] = useState('');
  const [tagShortsModalOpen, setTagShortsModalOpen] = useState(false);
  const [tagShortsConfirmValue, setTagShortsConfirmValue] = useState('');
  const [taggingShorts, setTaggingShorts] = useState(false);
  const [mergeShortModalOpen, setMergeShortModalOpen] = useState(false);
  const [tagLongVideosModalOpen, setTagLongVideosModalOpen] = useState(false);
  const [mergeShortConfirmValue, setMergeShortConfirmValue] = useState('');
  const [tagLongVideosConfirmValue, setTagLongVideosConfirmValue] = useState('');
  const [mergingShortTags, setMergingShortTags] = useState(false);
  const [taggingLongVideos, setTaggingLongVideos] = useState(false);

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
          <Button type="link" href={apiUrl('/dictionary/schema')} download>
            Download JSON Schema
          </Button>
          <Button type="link" href={apiUrl('/dictionary/example')} download>
            Download Example JSON
          </Button>
          <Button type="link" href={apiUrl('/dictionary/export')} download>
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
            <Space>
              <Button danger onClick={() => setClearModalOpen(true)}>
                Clear Media Library
              </Button>
              <Button danger onClick={() => setTagShortsModalOpen(true)}>
                Check durations and tag Shorts
              </Button>
              <Button danger onClick={() => setTagLongVideosModalOpen(true)}>
                Check durations and tag Long Videos
              </Button>
              <Button danger onClick={() => setMergeShortModalOpen(true)}>
                Merge short → shorts tags
              </Button>
            </Space>
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
            } catch (error: unknown) {
              notification.error({ message: toErrorMessage(error) || 'Import failed' });
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
          } catch (error: unknown) {
            notification.error({ message: toErrorMessage(error) || 'Clear failed' });
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

      <Modal
        open={tagShortsModalOpen}
        onCancel={() => {
          if (taggingShorts) return;
          setTagShortsModalOpen(false);
          setTagShortsConfirmValue('');
        }}
        onOk={async () => {
          setTaggingShorts(true);
          try {
            const { checked, eligible, tagged, alreadyTagged } =
              await dictionaryApi.tagShortsByDuration();
            notification.success({
              message: 'Shorts tagging completed',
              description: `Checked: ${checked}, eligible: ${eligible}, tagged: ${tagged}, already tagged: ${alreadyTagged}`,
            });
            setTagShortsModalOpen(false);
            setTagShortsConfirmValue('');
          } catch (error: unknown) {
            notification.error({ message: toErrorMessage(error) || 'Shorts tagging failed' });
          } finally {
            setTaggingShorts(false);
          }
        }}
        okButtonProps={{
          danger: true,
          disabled: tagShortsConfirmValue !== 'SHORTS',
          loading: taggingShorts,
        }}
        okText="Tag Shorts"
        title="Check all videos and tag Shorts?"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            This will scan all videos with known duration and add the 'shorts' tag to videos shorter
            than 1 minute 30 seconds. Videos will not be deleted or modified otherwise.
          </Typography.Text>
          <Typography.Text>Type SHORTS to confirm:</Typography.Text>
          <Input
            value={tagShortsConfirmValue}
            onChange={(e) => setTagShortsConfirmValue(e.target.value)}
            disabled={taggingShorts}
          />
        </Space>
      </Modal>

      <Modal
        open={tagLongVideosModalOpen}
        onCancel={() => {
          if (taggingLongVideos) return;
          setTagLongVideosModalOpen(false);
          setTagLongVideosConfirmValue('');
        }}
        onOk={async () => {
          setTaggingLongVideos(true);
          try {
            const { checked, eligible, tagged, alreadyTagged } =
              await dictionaryApi.tagLongVideosByDuration();
            notification.success({
              message: 'Long video tagging completed',
              description: `Checked: ${checked}, eligible: ${eligible}, tagged: ${tagged}, already tagged: ${alreadyTagged}`,
            });
            setTagLongVideosModalOpen(false);
            setTagLongVideosConfirmValue('');
          } catch (error: unknown) {
            notification.error({ message: toErrorMessage(error) || 'Long video tagging failed' });
          } finally {
            setTaggingLongVideos(false);
          }
        }}
        okButtonProps={{
          danger: true,
          disabled: tagLongVideosConfirmValue !== 'LONG',
          loading: taggingLongVideos,
        }}
        okText="Tag Long Videos"
        title="Check all videos and tag Long Videos?"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            This will scan all videos with known duration and add the 'длинное видео' tag to videos
            longer than 20 minutes. Videos will not be deleted or modified otherwise.
          </Typography.Text>
          <Typography.Text>Type LONG to confirm:</Typography.Text>
          <Input
            value={tagLongVideosConfirmValue}
            onChange={(e) => setTagLongVideosConfirmValue(e.target.value)}
            disabled={taggingLongVideos}
          />
        </Space>
      </Modal>

      <Modal
        open={mergeShortModalOpen}
        onCancel={() => {
          if (mergingShortTags) return;
          setMergeShortModalOpen(false);
          setMergeShortConfirmValue('');
        }}
        onOk={async () => {
          setMergingShortTags(true);
          try {
            const { moved, removedLegacyTag } = await dictionaryApi.mergeShortTags();
            notification.success({
              message: 'Short tags merge completed',
              description: `Moved: ${moved}, removed legacy tag: ${removedLegacyTag ? 'yes' : 'no'}`,
            });
            setMergeShortModalOpen(false);
            setMergeShortConfirmValue('');
          } catch (error: unknown) {
            notification.error({ message: toErrorMessage(error) || 'Merge failed' });
          } finally {
            setMergingShortTags(false);
          }
        }}
        okButtonProps={{
          danger: true,
          disabled: mergeShortConfirmValue !== 'MERGE',
          loading: mergingShortTags,
        }}
        okText="Merge"
        title="Merge short → shorts tags?"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>
            This will move all video links from the legacy 'short' tag to canonical 'shorts' and
            delete the legacy tag. Videos will not be deleted.
          </Typography.Text>
          <Typography.Text>Type MERGE to confirm:</Typography.Text>
          <Input
            value={mergeShortConfirmValue}
            onChange={(e) => setMergeShortConfirmValue(e.target.value)}
            disabled={mergingShortTags}
          />
        </Space>
      </Modal>
    </Space>
  );
}
