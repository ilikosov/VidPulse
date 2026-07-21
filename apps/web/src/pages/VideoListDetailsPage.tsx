import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification,
} from '@vidpulse/ui';
import { ExclamationCircleOutlined, FilterOutlined, PaperClipOutlined } from '@ant-design/icons';
import { StatusBadge } from '@vidpulse/ui';
import { batchVideoOperation, getListDetails } from '../api/videoListsApi';
import type { VideoListDetails, VideoListVideo } from '../api/videoListsApi';
import { getFiles } from '../api/filesApi';
import VideoListOperations from '../components/VideoListOperations';
import { useVideoDrawer } from '../components/VideoDrawerProvider';
import { useFileEditorDrawer } from '../components/FileEditorDrawerProvider';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';

export default function VideoListDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openVideo } = useVideoDrawer();
  const { openFileEditor } = useFileEditorDrawer();
  const { page, limit, setPagination, searchParams, setSearchParams } =
    usePaginationSearchParams(20);
  const duplicatesOnly = searchParams.get('duplicatesOnly') === 'true';
  const filenameFilter = searchParams.get('filename') ?? undefined;

  const [list, setList] = useState<VideoListDetails | null>(null);
  const [videos, setVideos] = useState<VideoListVideo[]>([]);
  const [pagination, setPaginationState] = useState({ page: 1, limit: 20, total: 0 });
  const [allVideoIds, setAllVideoIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchVideos();
  }, [id, page, limit, duplicatesOnly, filenameFilter]);

  async function fetchVideos() {
    setLoading(true);
    try {
      const res = await getListDetails(Number(id), {
        page,
        limit,
        duplicatesOnly,
        predictedFilename: filenameFilter,
      });
      setList(res);
      setVideos(res.videos);
      setPaginationState(res.pagination);
      setAllVideoIds(res.allVideoIds);
    } catch (err) {
      notification.error({ message: 'Failed to fetch list videos' });
    } finally {
      setLoading(false);
    }
  }

  // The list's status is homogeneous across its videos (see video-list.service.ts
  // recomputeStatus), so this is correct for the whole list, not just the current page.
  const hasNeedsReview = list?.status === 'needs_review';

  // A video can have several linked files; this opens the first one — the same "first linked
  // file" convention predicted_filename/orientation already use for a representative file.
  async function handleOpenFile(videoId: number) {
    try {
      const { files } = await getFiles({ videoId, limit: 1 });
      if (files.length === 0) {
        notification.error({ message: 'No linked file found' });
        return;
      }
      openFileEditor(files[0].id, fetchVideos);
    } catch (err: any) {
      notification.error({ message: err?.message || 'Failed to open file editor' });
    }
  }

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
      render: (status?: string | null) => <StatusBadge status={status} />,
    },
    {
      title: 'File',
      dataIndex: 'has_file',
      key: 'has_file',
      width: 60,
      align: 'center' as const,
      render: (hasFile: boolean, record: VideoListVideo) =>
        record.file_on_disk ? (
          <Tooltip title="Linked file on disk — open file editor">
            <a onClick={() => void handleOpenFile(record.id)} style={{ cursor: 'pointer' }}>
              <PaperClipOutlined style={{ color: '#52c41a' }} />
            </a>
          </Tooltip>
        ) : hasFile ? (
          <Tooltip title="Linked file missing on disk — open to fix">
            <a onClick={() => void handleOpenFile(record.id)} style={{ cursor: 'pointer' }}>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            </a>
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
      title: 'Filename',
      dataIndex: 'predicted_filename',
      key: 'predicted_filename',
      render: (filename: string | null, record: VideoListVideo) => {
        if (!filename) return <Typography.Text type="secondary">—</Typography.Text>;
        if (!record.has_duplicate_name) return filename;
        return (
          <Space size={4}>
            <Tooltip title="Duplicate predicted filename in this list">
              <Typography.Text type="danger">{filename}</Typography.Text>
            </Tooltip>
            <Tooltip title="Show all videos with this filename">
              <Button
                type="text"
                size="small"
                icon={<FilterOutlined />}
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.set('filename', filename);
                  params.delete('page');
                  setSearchParams(params);
                }}
              />
            </Tooltip>
          </Space>
        );
      },
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
        <Checkbox
          checked={duplicatesOnly}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.checked) params.set('duplicatesOnly', 'true');
            else params.delete('duplicatesOnly');
            params.delete('page');
            setSearchParams(params);
          }}
        >
          Show only duplicate names
        </Checkbox>
        {filenameFilter ? (
          <Tag
            closable
            onClose={() => {
              const params = new URLSearchParams(searchParams);
              params.delete('filename');
              params.delete('page');
              setSearchParams(params);
            }}
          >
            Имя файла: {filenameFilter}
          </Tag>
        ) : null}
      </Space>
      <VideoListOperations listId={Number(id)} videoIds={allVideoIds} refreshVideos={fetchVideos} />
      <Table
        dataSource={videos}
        rowKey="id"
        loading={loading}
        columns={columns}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => setPagination({ page: nextPage, limit: nextLimit }),
        }}
      />
    </div>
  );
}
