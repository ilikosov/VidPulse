import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { addPlaylist, deletePlaylist, getPlaylists, type Playlist } from '../api';

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removeVideos, setRemoveVideos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ url: string }>();

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const response = await getPlaylists();
      setPlaylists(response.playlists);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPlaylists();
  }, []);

  const onAddPlaylist = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await addPlaylist(values.url);
      message.success('Playlist added successfully');
      setIsModalOpen(false);
      form.resetFields();
      await fetchPlaylists();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onDeletePlaylist = async (id: number) => {
    try {
      await deletePlaylist(id, removeVideos);
      message.success('Playlist deleted');
      await fetchPlaylists();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete playlist');
    }
  };

  const columns: ColumnsType<Playlist> = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Playlist ID', dataIndex: 'youtube_id', key: 'youtube_id' },
    {
      title: 'Date Added',
      dataIndex: 'added_at',
      key: 'added_at',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: 'Last Checked',
      dataIndex: 'last_checked_at',
      key: 'last_checked_at',
      render: (value?: string | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="Delete this playlist?"
          description="This action cannot be undone."
          onConfirm={() => void onDeletePlaylist(record.id)}
          okText="Delete"
          cancelText="Cancel"
        >
          <Button danger size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Playlists
          </Typography.Title>
          <Space>
            <Checkbox checked={removeVideos} onChange={(e) => setRemoveVideos(e.target.checked)}>
              Delete associated videos
            </Checkbox>
            <Button type="primary" onClick={() => setIsModalOpen(true)}>
              Add Playlist
            </Button>
          </Space>
        </Space>

        <Table rowKey="id" loading={loading} columns={columns} dataSource={playlists} pagination={false} />
      </Space>

      <Modal
        title="Add Playlist"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => void onAddPlaylist()}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="YouTube Playlist URL"
            name="url"
            rules={[{ required: true, message: 'Please enter a playlist URL' }]}
          >
            <Input placeholder="https://www.youtube.com/playlist?list=..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default PlaylistsPage;
