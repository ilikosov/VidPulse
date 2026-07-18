import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Space,
  Spin,
  Popconfirm,
  Tag,
  Typography,
  Collapse,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  getVideos,
  ignoreVideo,
  reparseBatch,
  reparseVideo,
  resyncVideo,
  suggestMetadata,
  updateMetadata,
  type Video,
} from '../api';
import AutocompleteField from './AutocompleteField';
import SongTitlesField from './SongTitlesField';

interface ReviewVideo extends Video {
  editForm: {
    perf_date: string;
    group_name: string;
    artist_name: string;
    song_titles: string[];
    event: string;
    camera_type: string;
  };
  saving: boolean;
  suggesting: boolean;
  saved: boolean;
  reparsing: boolean;
  resyncing: boolean;
}

function formatDateForEdit(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function songsToTitles(video: Video): string[] {
  if (video.songs?.length) return video.songs.map((song) => song.title);
  if (!video.song_title) return [];
  return video.song_title
    .split(/\s*\+\s*/)
    .map((song) => song.trim())
    .filter(Boolean);
}

function ReviewQueue() {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkReparsing, setBulkReparsing] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const videoListId = searchParams.get('video_list_id') ?? '';
  const listName = (location.state as { listName?: string } | null)?.listName;

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideos({
        status: 'needs_review',
        limit: 50,
        video_list_id: videoListId ? Number(videoListId) : undefined,
      });
      setVideos(
        response.videos.map((video) => ({
          ...video,
          editForm: {
            perf_date: formatDateForEdit(video.perf_date),
            group_name: video.group_name || '',
            artist_name: video.artist_name || '',
            song_titles: songsToTitles(video),
            event: video.event ? video.event.replace(/^@+/, '') : '',
            camera_type: video.camera_type || '',
          },
          saving: false,
          suggesting: false,
          saved: false,
          reparsing: false,
          resyncing: false,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVideos();
  }, [videoListId]);

  const handleFieldChange = (id: number, key: keyof ReviewVideo['editForm'], value: string) => {
    setVideos((prev) =>
      prev.map((video) =>
        video.id === id ? { ...video, editForm: { ...video.editForm, [key]: value } } : video,
      ),
    );
  };

  const handleSongTitlesChange = (id: number, value: string[]) => {
    setVideos((prev) =>
      prev.map((video) =>
        video.id === id ? { ...video, editForm: { ...video.editForm, song_titles: value } } : video,
      ),
    );
  };

  const handleIgnore = async (video: ReviewVideo) => {
    try {
      await ignoreVideo(video.id);
      message.success(`Ignored: ${video.original_title}`);
      setVideos((prev) => prev.filter((item) => item.id !== video.id));
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to ignore video');
    }
  };

  const toMetadataPayload = (video: ReviewVideo) => ({
    perf_date: video.editForm.perf_date || null,
    group_name: video.editForm.group_name || null,
    artist_name: video.editForm.artist_name || null,
    song_titles: video.editForm.song_titles,
    event: video.editForm.event ? video.editForm.event.toUpperCase() : null,
    camera_type: video.editForm.camera_type || null,
  });

  // Save edits for every video in the queue, then return to the originating list (if any).
  const handleSaveAll = async () => {
    if (videos.length === 0) return;
    setBulkSaving(true);
    const results = await Promise.allSettled(
      videos.map((video) => updateMetadata(video.id, toMetadataPayload(video))),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    setBulkSaving(false);
    if (failed > 0) {
      message.error(`Не удалось сохранить ${failed} из ${videos.length}`);
      await fetchVideos();
      return;
    }
    message.success(`Сохранено: ${videos.length}`);
    if (videoListId) {
      navigate(`/video-lists/${videoListId}`);
    } else {
      await fetchVideos();
    }
  };

  // Re-parse every video currently in the queue (re-fetches metadata from YouTube).
  const handleReparseAll = async () => {
    if (videos.length === 0) return;
    setBulkReparsing(true);
    try {
      const { updated } = await reparseBatch(videos.map((video) => video.id));
      message.success(`Reparsed: ${updated}`);
      await fetchVideos();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to reparse videos');
    } finally {
      setBulkReparsing(false);
    }
  };

  const handleSuggest = async (video: ReviewVideo) => {
    setVideos((prev) =>
      prev.map((item) => (item.id === video.id ? { ...item, suggesting: true } : item)),
    );
    try {
      const suggestion = await suggestMetadata(video.id);
      setVideos((prev) =>
        prev.map((item) =>
          item.id === video.id
            ? {
                ...item,
                suggesting: false,
                editForm: {
                  ...item.editForm,
                  perf_date: suggestion.perf_date ?? '',
                  group_name: suggestion.group_name ?? '',
                  artist_name: suggestion.artist_name ?? '',
                  song_titles: suggestion.song_title
                    ? suggestion.song_title
                        .split(/\s*\+\s*/)
                        .map((song) => song.trim())
                        .filter(Boolean)
                    : [],
                  event: suggestion.event ? suggestion.event.replace(/^@+/, '') : '',
                  camera_type: suggestion.camera_type ?? '',
                },
              }
            : item,
        ),
      );
      message.success('AI suggestion applied');
    } catch (err) {
      setVideos((prev) =>
        prev.map((item) => (item.id === video.id ? { ...item, suggesting: false } : item)),
      );
      message.error(err instanceof Error ? err.message : 'AI suggestion failed');
    }
  };

  const handleReparse = async (video: ReviewVideo) => {
    setVideos((prev) =>
      prev.map((item) => (item.id === video.id ? { ...item, reparsing: true } : item)),
    );
    try {
      await reparseVideo(video.id);
      message.success(`Reparsed: ${video.original_title}`);
      await fetchVideos();
    } catch (err) {
      setVideos((prev) =>
        prev.map((item) => (item.id === video.id ? { ...item, reparsing: false } : item)),
      );
      message.error(err instanceof Error ? err.message : 'Failed to reparse video');
    }
  };

  const handleResync = async (video: ReviewVideo) => {
    setVideos((prev) =>
      prev.map((item) => (item.id === video.id ? { ...item, resyncing: true } : item)),
    );
    try {
      const updated = await resyncVideo(video.id);
      message.success(`Resynced: ${video.original_title}`);
      if (updated.status !== 'needs_review') {
        setVideos((prev) => prev.filter((item) => item.id !== video.id));
      } else {
        await fetchVideos();
      }
    } catch (err) {
      setVideos((prev) =>
        prev.map((item) => (item.id === video.id ? { ...item, resyncing: false } : item)),
      );
      message.error(err instanceof Error ? err.message : 'Failed to resync video');
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Review Queue
        </Typography.Title>
        <Typography.Text type="secondary">
          Videos that need manual review. Correct the metadata and save to move them to “new”
          status.
        </Typography.Text>
      </div>

      {videoListId ? (
        <Space>
          <Typography.Text>Список:</Typography.Text>
          <Tag color="blue">{listName ?? `#${videoListId}`}</Tag>
          <Link to="/review">Показать все</Link>
        </Space>
      ) : null}

      {videos.length > 0 ? (
        <Space>
          <Button type="primary" loading={bulkSaving} onClick={() => void handleSaveAll()}>
            Save all & move to new
          </Button>
          <Button loading={bulkReparsing} onClick={() => void handleReparseAll()}>
            Reparse all
          </Button>
        </Space>
      ) : null}

      {error ? <Alert type="error" message={error} /> : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : null}

      {!loading && videos.length === 0 ? (
        <Empty description="All caught up! No videos need review." />
      ) : null}

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {videos.map((video) => (
          <Card
            key={video.id}
            style={{
              opacity: video.saved ? 0.65 : 1,
              borderColor: video.saved ? '#b7eb8f' : undefined,
            }}
            title={
              <Space>
                <img
                  src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                  width={120}
                  style={{ borderRadius: 4 }}
                />
                <div>
                  <Typography.Text strong>{video.original_title}</Typography.Text>
                  <br />
                  <a
                    href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Watch on YouTube
                  </a>
                </div>
              </Space>
            }
            extra={video.saved ? <Tag color="success">Saved</Tag> : null}
          >
            <Collapse
              size="small"
              items={[
                {
                  key: 'description',
                  label: 'Description',
                  children: (
                    <Typography.Paragraph
                      style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                      ellipsis={{ rows: 4, expandable: 'collapsible', symbol: 'Show more' }}
                    >
                      {video.description?.trim() || 'No description.'}
                    </Typography.Paragraph>
                  ),
                },
              ]}
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteField
                  style={{ width: '100%' }}
                  label="Performance Date (YYMMDD)"
                  type="group"
                  value={video.editForm.perf_date}
                  onChange={(value) => handleFieldChange(video.id, 'perf_date', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteField
                  style={{ width: '100%' }}
                  label="Group Name"
                  type="group"
                  value={video.editForm.group_name}
                  onChange={(value) => handleFieldChange(video.id, 'group_name', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteField
                  style={{ width: '100%' }}
                  label="Artist Name"
                  type="artist"
                  value={video.editForm.artist_name}
                  onChange={(value) => handleFieldChange(video.id, 'artist_name', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <SongTitlesField
                  style={{ width: '100%' }}
                  label="Songs"
                  value={video.editForm.song_titles}
                  onChange={(value) => handleSongTitlesChange(video.id, value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteField
                  style={{ width: '100%' }}
                  label="Event"
                  type="event"
                  value={video.editForm.event}
                  onChange={(value) => handleFieldChange(video.id, 'event', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>Camera Type</div>
                <Input
                  value={video.editForm.camera_type}
                  onChange={(event) =>
                    handleFieldChange(video.id, 'camera_type', event.target.value)
                  }
                />
              </Col>
            </Row>

            <Space style={{ marginTop: 16 }}>
              <Button
                onClick={() => void handleSuggest(video)}
                loading={video.suggesting}
                disabled={video.saved || video.reparsing || !video.original_title}
              >
                Suggest with AI
              </Button>
              <Button
                onClick={() => void handleReparse(video)}
                loading={video.reparsing}
                disabled={video.saved}
              >
                Reparse
              </Button>
              <Button
                onClick={() => void handleResync(video)}
                loading={video.resyncing}
                disabled={video.saved || video.reparsing}
              >
                Resync
              </Button>
              <Popconfirm
                title="Ignore this video?"
                description="Are you sure you want to ignore this video? It will be hidden from views."
                okText="Ignore"
                cancelText="Cancel"
                onConfirm={() => void handleIgnore(video)}
              >
                <Button danger disabled={video.saved || video.saving}>
                  Ignore
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        ))}
      </Space>
    </Space>
  );
}

export default ReviewQueue;
