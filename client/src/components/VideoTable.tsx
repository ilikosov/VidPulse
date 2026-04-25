import { Alert, Image, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideos, type Pagination, type Video } from '../api';

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
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
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
        <Image src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} alt="Thumbnail" width={120} preview={false} />
      ),
    },
    { title: 'Original Title', dataIndex: 'original_title', key: 'original_title', ellipsis: true },
    { title: 'Group', dataIndex: 'group_name', key: 'group_name', render: (v: string | null) => v || '-' },
    { title: 'Artist', dataIndex: 'artist_name', key: 'artist_name', render: (v: string | null) => v || '-' },
    { title: 'Song', dataIndex: 'song_title', key: 'song_title', render: (v: string | null) => v || '-' },
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
        new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    },
  ];

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          rowKey="id"
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
