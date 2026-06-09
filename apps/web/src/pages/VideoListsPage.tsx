import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, notification } from 'antd';
import { getVideoLists } from '../api/videoListsApi';
import type { VideoListSummary } from '../api/videoListsApi';

export default function VideoListsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<VideoListSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLists();
  }, []);

  async function fetchLists() {
    setLoading(true);
    try {
      const res = await getVideoLists();
      setLists(res);
    } catch (err) {
      notification.error({ message: 'Failed to fetch video lists' });
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      render: (c: string) => <Tag color={c}>{c}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status?: string | null) => (status ? <Tag color="blue">{status}</Tag> : null),
    },
    { title: 'Videos Count', dataIndex: 'countVideos', key: 'countVideos' },
  ];

  return (
    <div>
      <h1>Video Lists</h1>
      <Table
        dataSource={lists}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/video-lists/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={columns}
      />
    </div>
  );
}
