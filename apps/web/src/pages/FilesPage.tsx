import { useEffect, useState } from 'react';
import { Button, Space, Table, Tag, Tooltip, Typography, message, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { getFiles, scanFiles } from '../api/filesApi';
import type { FileRecord } from '../api/filesApi';
import { useVideoDrawer } from '../components/VideoDrawerProvider';
import { useFileEditorDrawer } from '../components/FileEditorDrawerProvider';

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

export default function FilesPage() {
  const { openVideo } = useVideoDrawer();
  const { openFileEditor } = useFileEditorDrawer();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  async function fetchFiles(nextPage = page, nextLimit = limit) {
    setLoading(true);
    try {
      const res = await getFiles({ page: nextPage, limit: nextLimit });
      setFiles(res.files);
      setTotal(res.total);
    } catch (err: any) {
      notification.error({ message: err?.message || 'Failed to fetch files' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchFiles(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  async function handleScan() {
    setScanning(true);
    try {
      const result = await scanFiles();
      message.success(
        `Scan complete: ${result.scanned} scanned, ${result.linked} linked` +
          (result.errors.length ? `, ${result.errors.length} errors` : ''),
      );
      await fetchFiles(page, limit);
    } catch (err: any) {
      message.error(err?.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  const columns: ColumnsType<FileRecord> = [
    { title: 'Filename', dataIndex: 'filename', key: 'filename', ellipsis: true },
    {
      title: 'Extension',
      dataIndex: 'extension',
      key: 'extension',
      width: 110,
      render: (ext: string | null) => ext ?? '—',
    },
    {
      title: 'Size',
      dataIndex: 'size_bytes',
      key: 'size_bytes',
      width: 110,
      render: (bytes: number | null) => formatBytes(bytes),
    },
    {
      title: 'YouTube ID',
      dataIndex: 'youtube_id',
      key: 'youtube_id',
      width: 140,
      render: (id: string | null) => (id ? <Tag>{id}</Tag> : <Tag color="default">none</Tag>),
    },
    {
      title: 'Video',
      dataIndex: 'video_id',
      key: 'video_id',
      render: (videoId: number | null, record) => (
        <Space size={6}>
          {/* The link icon only appears when the file is actually on disk — a linked row whose
              file is missing shows a warning instead, so linkage isn't confused with presence. */}
          <Tooltip
            title={
              !record.exists_on_disk
                ? 'File not on disk — open to fix'
                : videoId != null
                  ? 'Edit file / linked video'
                  : 'Edit file / link a video'
            }
          >
            <a onClick={() => openFileEditor(record.id, () => fetchFiles(page, limit))}>
              {record.exists_on_disk ? (
                <LinkOutlined style={{ color: videoId != null ? '#52c41a' : '#bfbfbf' }} />
              ) : (
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              )}
            </a>
          </Tooltip>
          {videoId != null ? (
            <a onClick={() => openVideo(videoId, () => fetchFiles(page, limit))}>
              {record.video_title || `#${videoId}`}
            </a>
          ) : (
            <Typography.Text type="secondary">unlinked</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Scanned At',
      dataIndex: 'scanned_at',
      key: 'scanned_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Files
        </Typography.Title>
        <Button type="primary" loading={scanning} onClick={handleScan}>
          Scan Files
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={files}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setLimit(nextPageSize);
          },
        }}
      />
    </Space>
  );
}
