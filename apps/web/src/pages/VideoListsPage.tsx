import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, notification } from 'antd';
import { getVideoLists, getListDetails } from '../api/videoListsApi';

export default function VideoListsPage() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [videos, setVideos] = useState([]);

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

  async function openList(listId: number) {
    setSelectedListId(listId);
    try {
      const res = await getListDetails(listId);
      setVideos(res.videos);
    } catch (err) {
      notification.error({ message: 'Failed to fetch list details' });
    }
  }

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Artist', dataIndex: 'artist', key: 'artist' },
    { title: 'Group', dataIndex: 'group', key: 'group' },
    { title: 'Duration', dataIndex: 'duration', key: 'duration' },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map((t) => <Tag key={t}>{t}</Tag>),
    },
  ];

  return (
    <div>
      <h1>Video Lists</h1>
      <Table
        dataSource={lists}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({
          onClick: () => openList(record.id),
        })}
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name' },
          {
            title: 'Color',
            dataIndex: 'color',
            key: 'color',
            render: (c: string) => <Tag color={c}>{c}</Tag>,
          },
          { title: 'Videos Count', dataIndex: 'countVideos', key: 'countVideos' },
        ]}
      />
      {selectedListId && (
        <div>
          <h2>Videos in List</h2>
          <Table dataSource={videos} rowKey="id" columns={columns} />
        </div>
      )}
    </div>
  );
}
