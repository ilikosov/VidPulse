import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Popconfirm, Space, Table, Tag, Tooltip, Typography, notification } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { batchVideoOperation, getListDetails } from '../api/videoListsApi';
import type { VideoListDetails, VideoListVideo } from '../api/videoListsApi';
import VideoListOperations from '../components/VideoListOperations';
import { useVideoDrawer } from '../components/VideoDrawerProvider';

export default function VideoListDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openVideo } = useVideoDrawer();
  const [list, setList] = useState<VideoListDetails | null>(null);
  const [videos, setVideos] = useState<VideoListVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, [id]);

  async function fetchVideos() {
    setLoading(true);
    try {
      const res = await getListDetails(Number(id));
      setList(res);
      setVideos(res.videos);
    } catch (err) {
      notification.error({ message: 'Failed to fetch list videos' });
    } finally {
      setLoading(false);
    }
  }

  const hasNeedsReview = videos.some((v) => v.status === 'needs_review');

  async function handleRemoveVideo(videoId: number) {
    try {
      await batchVideoOperation(Number(id), 'removeFromList', { videoIds: [videoId] });
      fetchVideos();
    } catch (err: any) {
      notification.error({ message: err?.message || 'Failed to remove video from list' });
    }
  }

  const columns = [
    {
      title: 'Thumbnail',
      dataIndex: 'youtube_id',
      key: 'youtube_id',
      width: 140,
      render: (youtubeId: string, record: VideoListVideo) => (
        <a onClick={() => openVideo(record.id, fetchVideos)} style={{ cursor: 'pointer' }}>
          <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} width={120} />
        </a>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: VideoListVideo) => (
        <a onClick={() => openVideo(record.id, fetchVideos)} style={{ cursor: 'pointer' }}>
          {title}
        </a>
      ),
    },
    { title: 'Artist', dataIndex: 'artist', key: 'artist' },
    { title: 'Group', dataIndex: 'group', key: 'group' },
    { title: 'Duration', dataIndex: 'duration', key: 'duration' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status?: string | null) => (status ? <Tag>{status}</Tag> : null),
    },
    {
      title: 'File',
      dataIndex: 'has_file',
      key: 'has_file',
      width: 60,
      align: 'center' as const,
      render: (hasFile: boolean) =>
        hasFile ? (
          <Tooltip title="Linked file on disk">
            <PaperClipOutlined style={{ color: '#52c41a' }} />
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map((t) => <span key={t}>{t} </span>),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: VideoListVideo) => (
        <Popconfirm
          title="Remove this video from the list?"
          onConfirm={() => handleRemoveVideo(record.id)}
        >
          <Button danger size="small">
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space align="center" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>
          {list ? list.name : 'Video List Details'}{' '}
          {list?.status ? <Tag color="blue">{list.status}</Tag> : null}
        </h1>
        <Tooltip title={hasNeedsReview ? '' : 'Нет видео для ревью'}>
          <Button
            disabled={!hasNeedsReview}
            onClick={() =>
              navigate(`/review?video_list_id=${id}`, { state: { listName: list?.name } })
            }
          >
            Ревью
          </Button>
        </Tooltip>
      </Space>
      <VideoListOperations
        listId={Number(id)}
        videoIds={videos.map((v) => v.id)}
        refreshVideos={fetchVideos}
      />
      <Table dataSource={videos} rowKey="id" loading={loading} columns={columns} />
    </div>
  );
}
