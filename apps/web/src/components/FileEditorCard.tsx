import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Image,
  Popconfirm,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { deleteFile, getFile, getFileThumbnails, linkFileToVideo } from '../api/filesApi';
import type { FileDetails } from '../api/filesApi';
import VideoSearchSelect from './VideoSearchSelect';

const { Title, Text } = Typography;

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function resolutionLabel(width: number | null, height: number | null): string {
  if (width == null || height == null) return '—';
  return `${width}×${height} (${width >= height ? 'horizontal' : 'vertical'})`;
}

interface FileEditorCardProps {
  fileId: number;
  onChanged?: () => void;
  onDeleted?: () => void;
}

/** File editor drawer content: details, predicted rename preview, frame previews, and
 * link/unlink + delete actions. See VideoCard.tsx for the equivalent video-side pattern. */
export default function FileEditorCard({ fileId, onChanged, onDeleted }: FileEditorCardProps) {
  const [file, setFile] = useState<FileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(true);

  const fetchFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFile(await getFile(fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch file');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void fetchFile();
  }, [fetchFile]);

  // Independent from the details fetch — frame extraction can take a moment and shouldn't
  // block the rest of the drawer from rendering.
  useEffect(() => {
    setThumbnailsLoading(true);
    getFileThumbnails(fileId)
      .then((res) => setThumbnails(res.thumbnails))
      .catch(() => setThumbnails([]))
      .finally(() => setThumbnailsLoading(false));
  }, [fileId]);

  async function handleLink(videoId: number | null) {
    setLinking(true);
    try {
      await linkFileToVideo(fileId, videoId);
      message.success(videoId != null ? 'Video linked' : 'Video unlinked');
      await fetchFile();
      onChanged?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update link');
    } finally {
      setLinking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteFile(fileId);
      message.success('File record removed');
      onDeleted?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to delete file');
      setDeleting(false);
    }
  }

  if (loading) return <Spin size="large" fullscreen />;
  if (error) return <Alert type="error" message={error} />;
  if (!file) return <Alert type="warning" message="File not found" />;

  return (
    <Card bordered={false}>
      <Title level={4} style={{ marginTop: 0, wordBreak: 'break-all' }}>
        {file.filename}
      </Title>

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Size">{formatBytes(file.size_bytes)}</Descriptions.Item>
        <Descriptions.Item label="Resolution">
          {resolutionLabel(file.width, file.height)}
        </Descriptions.Item>
        <Descriptions.Item label="Path">{file.directory}</Descriptions.Item>
        <Descriptions.Item label="Renamed to">
          {file.predicted_filename ??
            (file.video_id == null ? 'video not linked' : 'no rename template configured')}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Title level={5}>Previews</Title>
      {thumbnailsLoading ? (
        <Spin />
      ) : thumbnails.length ? (
        <Image.PreviewGroup>
          <Space wrap>
            {thumbnails.map((src, i) => (
              <Image key={i} src={src} width={120} />
            ))}
          </Space>
        </Image.PreviewGroup>
      ) : (
        <Text type="secondary">No previews available</Text>
      )}

      <Divider />

      <Title level={5}>Linked video</Title>
      <VideoSearchSelect
        value={file.video_id}
        currentLabel={file.video_title}
        onChange={(id) => void handleLink(id)}
        disabled={linking}
      />

      <Divider />

      <Popconfirm title="Remove this file record?" onConfirm={() => void handleDelete()}>
        <Button danger loading={deleting}>
          Delete file record
        </Button>
      </Popconfirm>
    </Card>
  );
}
