import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Space, Table, Tag, notification } from '@vidpulse/ui';
import { createVideoList, getVideoLists } from '../api/videoListsApi';
import type { VideoListSummary } from '../api/videoListsApi';

export default function VideoListsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<VideoListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

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

  async function handleCreate() {
    if (!newName.trim()) {
      notification.error({ message: 'Please enter a list name' });
      return;
    }
    setCreating(true);
    try {
      await createVideoList({ name: newName.trim() });
      notification.success({ message: `Created list "${newName.trim()}"` });
      setCreateOpen(false);
      setNewName('');
      await fetchLists();
    } catch (err: any) {
      notification.error({ message: err?.message || 'Failed to create list' });
    } finally {
      setCreating(false);
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
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Video Lists</h1>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          + New List
        </Button>
      </Space>
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

      <Modal
        title="Create new list"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          setNewName('');
        }}
        confirmLoading={creating}
        okText="Create"
      >
        <Input
          placeholder="List name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreate}
        />
      </Modal>
    </div>
  );
}
