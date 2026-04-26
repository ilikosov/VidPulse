import { Alert, Button, Image, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  batchComplete,
  batchConfirmDownload,
  getVideos,
  reparseBatch,
  type Pagination,
  type Video,
} from '../api';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'error', label: 'Error' },
];

const statusColorMap: Record<string, string> = {
  new: 'green',
  needs_review: 'red',
  pending: 'gold',
  processing: 'blue',
  ready: 'purple',
  completed: 'default',
  error: 'error',
};

function VideoTable() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchVideos(1, statusFilter);
  }, [statusFilter]);

  const fetchVideos = async (page: number, status: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideos({ status: status || undefined, page, limit: 20 });
      setVideos(response.videos);
      setPagination(response.pagination);
      setSelectedRowKeys([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<Video> = [
    {
      title: 'Thumbnail',
      dataIndex: 'youtube_id',
      key: 'thumbnail',
      width: 140,
      render: (youtubeId: string) => (
        <Image
          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
          alt="Thumbnail"
          width={120}
          preview={false}
        />
      ),
    },
    { title: 'Original Title', dataIndex: 'original_title', key: 'original_title', ellipsis: true },
    {
      title: 'Group',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Artist',
      dataIndex: 'artist_name',
      key: 'artist_name',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Song',
      dataIndex: 'song_title',
      key: 'song_title',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColorMap[status] ?? 'default'}>{status}</Tag>,
    },
    {
      title: 'Date Added',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) =>
        new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
  ];

  const handleBatchAction = async (action: 'confirm-download' | 'complete' | 'reparse') => {
    if (selectedRowKeys.length === 0) {
      return;
    }

    setBatchLoading(true);
    try {
      if (action === 'confirm-download') {
        const result = await batchConfirmDownload(selectedRowKeys);
        message.success(`Confirm Download: ${result.succeeded}/${result.processed} succeeded`);
      } else if (action === 'complete') {
        const result = await batchComplete(selectedRowKeys);
        message.success(`Complete: ${result.succeeded}/${result.processed} succeeded`);
      } else {
        const result = await reparseBatch(selectedRowKeys);
        message.success(`Re-parse completed for ${result.updated} videos`);
      }

      await fetchVideos(pagination.page, statusFilter);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Batch operation failed');
    } finally {
      setBatchLoading(false);
    }
  };

  const rowSelection: TableRowSelection<Video> = {
    selectedRowKeys,
    onChange: (selectedKeys) => {
      setSelectedRowKeys(selectedKeys as number[]);
    },
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Video Library
      </Typography.Title>

      <Space align="center">
        <Typography.Text strong>Status:</Typography.Text>
        <Select
          value={statusFilter}
          options={statusOptions}
          style={{ width: 220 }}
          onChange={(value) => setStatusFilter(value)}
        />
      </Space>

      {error ? <Alert type="error" message={error} /> : null}

      {selectedRowKeys.length > 0 ? (
        <Space>
          <Typography.Text>{selectedRowKeys.length} selected</Typography.Text>
          <Button
            onClick={() => void handleBatchAction('confirm-download')}
            loading={batchLoading}
            disabled={batchLoading}
          >
            Confirm Download Selected
          </Button>
          <Button
            onClick={() => void handleBatchAction('complete')}
            loading={batchLoading}
            disabled={batchLoading}
          >
            Mark Selected as Complete
          </Button>
          <Button
            onClick={() => void handleBatchAction('reparse')}
            loading={batchLoading}
            disabled={batchLoading}
          >
            Re-parse Selected
          </Button>
        </Space>
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          rowKey="id"
          rowSelection={rowSelection}
          columns={columns}
          dataSource={videos}
          onRow={(record) => ({
            onClick: () => navigate(`/videos/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page) => {
              void fetchVideos(page, statusFilter);
            },
          }}
        />
      )}
    </Space>
  );
}

export default VideoTable;
