import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Tag, notification } from 'antd';
import { getListDetails } from '../api/videoListsApi';
import type { VideoListDetails, VideoListVideo } from '../api/videoListsApi';
import VideoListOperations from '../components/VideoListOperations';
import { useVideoDrawer } from '../components/VideoDrawerProvider';

export default function VideoListDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { openVideo } = useVideoDrawer();
  const [list, setList] = useState<VideoListDetails | null>(null);
  const [videos, setVideos] = useState<VideoListVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<number[]>([]);
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

  const rowSelection = {
    selectedRowKeys: selectedVideoIds,
    onChange: (selectedRowKeys: React.Key[]) => setSelectedVideoIds(selectedRowKeys as number[]),
  };

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
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map((t) => <span key={t}>{t} </span>),
    },
  ];

  return (
    <div>
      <h1>
        {list ? list.name : 'Video List Details'}{' '}
        {list?.status ? <Tag color="blue">{list.status}</Tag> : null}
      </h1>
      <VideoListOperations
        listId={Number(id)}
        selectedVideoIds={selectedVideoIds}
        refreshVideos={fetchVideos}
      />
      <Table
        dataSource={videos}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        columns={columns}
      />
    </div>
  );
}
