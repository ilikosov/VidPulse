import { Alert, Button, Form, Image, Input, Modal, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  batchComplete,
  batchAddTags,
  batchConfirmDownload,
  batchRemoveTags,
  getVideos,
  reparseBatch,
  type Pagination,
  type Video,
} from '../api';
import { getTagColor } from '../utils/tagColors';
import { formatDuration } from '../utils/formatDuration';

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
  const [batchTagModal, setBatchTagModal] = useState<{ open: boolean; mode: 'add' | 'remove' }>({
    open: false,
    mode: 'add',
  });
  const [batchTagName, setBatchTagName] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const navigate = useNavigate();
  const requiresManualTagConfirmation = (tagName: string) =>
    ['short', 'private'].includes(tagName.trim().toLowerCase());

  useEffect(() => {
    void fetchVideos(1, statusFilter);
  }, [statusFilter]);

  const fetchVideos = async (page: number, status: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideos({ status: status || undefined, page, limit: 20 });
      setVideos(response.videos);
      const tagSet = new Set<string>();
      response.videos.forEach((video) => video.tags?.forEach((tag) => tagSet.add(tag.name)));
      setAllTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
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
      title: 'Duration',
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      width: 110,
      render: (value: number | null | undefined) => formatDuration(value),
    },
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
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      width: 280,
      render: (tags?: Array<{ id: number; name: string }>) =>
        tags && tags.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {tags.map((tag) => (
              <Tag key={tag.id} color={getTagColor(tag.name)}>
                {tag.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
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


  const handleBatchPresetTag = async (tagName: 'short' | 'private') => {
    if (selectedRowKeys.length === 0) {
      return;
    }

    Modal.confirm({
      title: `Add "${tagName}" tag to ${selectedRowKeys.length} videos?`,
      content: 'This tag affects filtering and workflow. Do you want to continue?',
      okText: 'Yes, add tag',
      cancelText: 'Cancel',
      onOk: () => handleBatchTagAdd(tagName, true),
    });
  };

  const handleBatchTagAdd = async (tagName: string, confirm: boolean) => {
    if (selectedRowKeys.length === 0) {
      return;
    }

    setBatchLoading(true);
    try {
      const result = await batchAddTags(selectedRowKeys, tagName, confirm);
      message.success(`Add Tag "${tagName}": ${result.succeeded}/${result.processed} succeeded`);
      await fetchVideos(pagination.page, statusFilter);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Batch tag operation failed');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchTagSubmit = async () => {
    if (!batchTagName.trim()) {
      message.error('Please enter a tag name');
      return;
    }

    if (selectedRowKeys.length === 0) {
      message.error('Please select videos first');
      return;
    }

    setBatchLoading(true);
    try {
      if (batchTagModal.mode === 'add' && requiresManualTagConfirmation(batchTagName)) {
        setBatchLoading(false);
        Modal.confirm({
          title: `Add "${batchTagName}" tag to ${selectedRowKeys.length} videos?`,
          content: 'This tag affects filtering and workflow. Do you want to continue?',
          okText: 'Yes, add tag',
          cancelText: 'Cancel',
          onOk: async () => {
            await handleBatchTagAdd(batchTagName, true);
            setBatchTagModal((prev) => ({ ...prev, open: false }));
            setBatchTagName('');
          },
        });
        return;
      }
      const result =
        batchTagModal.mode === 'add'
          ? await batchAddTags(selectedRowKeys, batchTagName, false)
          : await batchRemoveTags(selectedRowKeys, batchTagName);
      message.success(
        `${batchTagModal.mode === 'add' ? 'Add Tag' : 'Remove Tag'}: ${result.succeeded}/${result.processed} succeeded`,
      );
      setBatchTagModal((prev) => ({ ...prev, open: false }));
      setBatchTagName('');
      await fetchVideos(pagination.page, statusFilter);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Batch tag operation failed');
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
          <Tooltip title="Add the 'short' tag to all selected videos">
            <Button
              onClick={() => void handleBatchPresetTag('short')}
              loading={batchLoading}
              disabled={batchLoading}
              style={{ borderColor: '#52c41a', color: '#389e0d' }}
            >
              Mark as Shorts
            </Button>
          </Tooltip>
          <Tooltip title="Add the 'private' tag to all selected videos">
            <Button
              onClick={() => void handleBatchPresetTag('private')}
              loading={batchLoading}
              disabled={batchLoading}
              style={{ borderColor: '#fa8c16', color: '#d46b08' }}
            >
              Mark as Private
            </Button>
          </Tooltip>
          <Button
            onClick={() => setBatchTagModal({ open: true, mode: 'add' })}
            loading={batchLoading}
            disabled={batchLoading}
          >
            Add Tag to Selected
          </Button>
          <Button
            onClick={() => setBatchTagModal({ open: true, mode: 'remove' })}
            loading={batchLoading}
            disabled={batchLoading}
          >
            Remove Tag from Selected
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

      <Modal
        title={batchTagModal.mode === 'add' ? 'Add Tag to Selected Videos' : 'Remove Tag from Selected Videos'}
        open={batchTagModal.open}
        confirmLoading={batchLoading}
        onCancel={() => {
          setBatchTagModal((prev) => ({ ...prev, open: false }));
          setBatchTagName('');
        }}
        onOk={() => void handleBatchTagSubmit()}
        okText={batchTagModal.mode === 'add' ? 'Add Tag' : 'Remove Tag'}
      >
        <Form layout="vertical">
          <Form.Item label="Tag name" required>
            <Select
              showSearch
              allowClear
              value={batchTagName || undefined}
              options={allTags.map((name) => ({ value: name, label: name }))}
              placeholder="Choose an existing tag or type a new one"
              onChange={(value) => setBatchTagName(value || '')}
              onSearch={(value) => setBatchTagName(value)}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div style={{ padding: 8 }}>
                    <Input
                      placeholder="Type new tag"
                      value={batchTagName}
                      onChange={(event) => setBatchTagName(event.target.value)}
                    />
                  </div>
                </>
              )}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default VideoTable;
