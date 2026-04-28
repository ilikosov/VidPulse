import {
  Alert,
  Avatar,
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
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import { InboxOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import {
  addChannel,
  deleteChannel,
  getChannels,
  importChannels,
  type Channel,
  type ImportChannelsResponse,
} from '../api';

function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [removeVideos, setRemoveVideos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
  const [importSummary, setImportSummary] = useState<ImportChannelsResponse | null>(null);
  const [form] = Form.useForm<{ url: string }>();

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await getChannels();
      setChannels(response.channels);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChannels();
  }, []);

  const onAddChannel = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await addChannel(values.url);
      message.success('Channel added successfully');
      setIsModalOpen(false);
      form.resetFields();
      await fetchChannels();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onImportChannels = async () => {
    if (!selectedFile?.originFileObj) {
      message.warning('Please select a .txt file to import');
      return;
    }

    try {
      setImporting(true);
      const summary = await importChannels(selectedFile.originFileObj);
      setImportSummary(summary);
      message.success(`Import completed: added ${summary.added}, skipped ${summary.skipped}`);
      await fetchChannels();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to import channels');
    } finally {
      setImporting(false);
    }
  };

  const onCloseImportModal = async () => {
    setIsImportModalOpen(false);
    setSelectedFile(null);
    setImportSummary(null);
    await fetchChannels();
  };

  const onDeleteChannel = async (id: number) => {
    try {
      await deleteChannel(id, removeVideos);
      message.success('Channel deleted');
      await fetchChannels();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete channel');
    }
  };

  const columns: ColumnsType<Channel> = [
    {
      title: 'Thumbnail',
      dataIndex: 'thumbnail_url',
      key: 'thumbnail_url',
      width: 100,
      render: (thumbnailUrl?: string | null) => <Avatar src={thumbnailUrl || undefined} shape="square" size={56} />,
    },
    { title: 'Channel Title', dataIndex: 'title', key: 'title' },
    { title: 'YouTube ID', dataIndex: 'youtube_id', key: 'youtube_id' },
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
          title="Delete this channel?"
          description="This action cannot be undone."
          onConfirm={() => void onDeleteChannel(record.id)}
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
            Channels
          </Typography.Title>
          <Space>
            <Checkbox checked={removeVideos} onChange={(e) => setRemoveVideos(e.target.checked)}>
              Delete associated videos
            </Checkbox>
            <Button onClick={() => setIsImportModalOpen(true)}>Import from File</Button>
            <Button type="primary" onClick={() => setIsModalOpen(true)}>
              Add Channel
            </Button>
          </Space>
        </Space>

        <Table rowKey="id" loading={loading} columns={columns} dataSource={channels} pagination={false} />
      </Space>

      <Modal
        title="Add Channel"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => void onAddChannel()}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="YouTube Channel URL"
            name="url"
            rules={[{ required: true, message: 'Please enter a channel URL' }]}
          >
            <Input placeholder="https://www.youtube.com/@channelname" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Import Channels from Text File"
        open={isImportModalOpen}
        onCancel={() => {
          if (!importing) {
            void onCloseImportModal();
          }
        }}
        onOk={() => void onImportChannels()}
        okText="Start Import"
        okButtonProps={{ disabled: importing || !selectedFile, loading: importing }}
        cancelButtonProps={{ disabled: importing }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Upload.Dragger
            accept=".txt"
            maxCount={1}
            beforeUpload={(file) => {
              setSelectedFile({
                uid: file.uid,
                name: file.name,
                status: 'done',
                size: file.size,
                type: file.type,
                originFileObj: file,
              });
              setImportSummary(null);
              return false;
            }}
            onRemove={() => {
              setSelectedFile(null);
              setImportSummary(null);
            }}
            fileList={selectedFile ? [selectedFile] : []}
            disabled={importing}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag a .txt file to this area</p>
            <p className="ant-upload-hint">One YouTube channel URL per line. Lines starting with # are ignored.</p>
          </Upload.Dragger>

          {importSummary && (
            <Alert
              type={importSummary.errors.length > 0 ? 'warning' : 'success'}
              message={`Added ${importSummary.added} channels, skipped ${importSummary.skipped}, processed ${importSummary.total} lines.`}
              description={
                importSummary.errors.length > 0
                  ? importSummary.errors.slice(0, 10).map((error, index) => <div key={`${error}-${index}`}>{error}</div>)
                  : 'No errors reported.'
              }
              showIcon
            />
          )}
        </Space>
      </Modal>
    </Card>
  );
}

export default ChannelsPage;
