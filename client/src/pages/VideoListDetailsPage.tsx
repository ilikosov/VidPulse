import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, notification } from 'antd';
import { getListDetails } from '../api/videoListsApi';
import VideoListOperations from '../components/VideoListOperations';

export default function VideoListDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [videos, setVideos] = useState([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, [id]);

  async function fetchVideos() {
    setLoading(true);
    try {
      const res = await getListDetails(Number(id));
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
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Artist', dataIndex: 'artist', key: 'artist' },
    { title: 'Group', dataIndex: 'group', key: 'group' },
    { title: 'Duration', dataIndex: 'duration', key: 'duration' },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map((t) => <span key={t}>{t} </span>),
    },
  ];

  return (
    <div>
      <h1>Video List Details</h1>
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
