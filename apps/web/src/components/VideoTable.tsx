import {
  Alert,
  Button,
  Checkbox,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';
import {
  batchComplete,
  batchAddTags,
  batchConfirmDownload,
  batchRemoveTags,
  getVideos,
  reparseBatch,
  llmParseBatch,
  type Pagination,
  type Video,
} from '../api';
import { getTagColor } from '../utils/tagColors';
import { formatDuration } from '../utils/formatDuration';
import { SongLinks } from './SongLinks';
import AddToListModal from './AddToListModal';

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
  const [pagination, setPaginationState] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { page, limit, setPagination, searchParams, setSearchParams } =
    usePaginationSearchParams(20);
  const statusFilter = searchParams.get('status') ?? '';
  const showIgnored = searchParams.get('includeIgnored') === 'true';
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [batchTagModal, setBatchTagModal] = useState<{ open: boolean; mode: 'add' | 'remove' }>({
    open: false,
    mode: 'add',
  });
  const [batchTagName, setBatchTagName] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const requiresManualTagConfirmation = (tagName: string) =>
    ['short', 'private'].includes(tagName.trim().toLowerCase());

  const fetchVideos = async (
    nextPage: number,
    nextLimit: number,
    status: string,
    includeIgnored = false,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideos({
        status: status || undefined,
        page: nextPage,
        limit: nextLimit,
        includeIgnored,
      });
      setVideos(response.videos);
      const tagSet = new Set<string>();
      response.videos.forEach((video) => video.tags?.forEach((tag) => tagSet.add(tag.name)));
      setAllTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
      setPaginationState(response.pagination);
      setSelectedRowKeys([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVideos(page, limit, statusFilter, showIgnored);
  }, [page, limit, statusFilter, showIgnored]);

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
      render: (_value: string | null, row: Video) =>
        row.group_name ? (
          row.group_id ? (
            <Link to={`/dictionary/groups/${row.group_id}`} state={{ from }}>
              {row.group_name}
            </Link>
          ) : (
            row.group_name
          )
        ) : (
          '-'
        ),
    },
    {
      title: 'Artist',
      dataIndex: 'artist_name',
      key: 'artist_name',
      render: (_value: string | null, row: Video) =>
        row.artist_name ? (
          row.artist_id ? (
            <Link to={`/dictionary/artists/${row.artist_id}`} state={{ from }}>
              {row.artist_name}
            </Link>
          ) : (
            row.artist_name
          )
        ) : (
          '-'
        ),
    },
    {
      title: 'Song',
      dataIndex: 'song_title',
      key: 'song_title',
      render: (_value: string | null, row: Video) => <SongLinks video={row} from={from} />,
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

  const handleBatchAction = async (
    action: 'confirm-download' | 'complete' | 'reparse' | 'llm-reparse',
  ) => {
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
      } else if (action === 'reparse') {
        const result = await reparseBatch(selectedRowKeys);
        message.success(`Re-parse completed for ${result.updated} videos`);
      } else {
        const result = await llmParseBatch(selectedRowKeys);
        message.success(`LLM parse completed for ${result.updated} videos`);
      }

      await fetchVideos(page, limit, statusFilter, showIgnored);
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
      await fetchVideos(page, limit, statusFilter, showIgnored);
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
      await fetchVideos(page, limit, statusFilter, showIgnored);
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
        <Checkbox
          checked={showIgnored}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.checked) params.set('includeIgnored', 'true');
            else params.delete('includeIgnored');
            params.delete('page');
            setSearchParams(params);
          }}
        >
          Show ignored
        </Checkbox>
        <Typography.Text strong>Status:</Typography.Text>
        <Select
          value={statusFilter}
          options={statusOptions}
          style={{ width: 220 }}
          onChange={(value) => {
            const params = new URLSearchParams(searchParams);
            if (value) params.set('status', value);
            else params.delete('status');
            params.delete('page');
            setSearchParams(params);
          }}
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
          <Button
            onClick={() => void handleBatchAction('llm-reparse')}
            loading={batchLoading}
            disabled={batchLoading}
          >
            LLM Parse Selected
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
          <Button type="primary" ghost onClick={() => setAddToListOpen(true)}>
            Add to List
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
            onClick: () =>
              navigate(`/videos/${record.id}`, {
                state: { from: `${location.pathname}${location.search}` },
              }),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              setPagination({ page: nextPage, limit: nextPageSize });
            },
          }}
        />
      )}

      <Modal
        title={
          batchTagModal.mode === 'add'
            ? 'Add Tag to Selected Videos'
            : 'Remove Tag from Selected Videos'
        }
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

      <AddToListModal
        open={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        videoIds={selectedRowKeys}
        onSuccess={() => {
          setSelectedRowKeys([]);
          void fetchVideos(page, limit, statusFilter, showIgnored);
        }}
      />
    </Space>
  );
}

export default VideoTable;
