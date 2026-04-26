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
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { getVideos, updateMetadata, type Video } from '../api';
import AutocompleteInput from './AutocompleteInput';

interface ReviewVideo extends Video {
  editForm: {
    perf_date: string;
    group_name: string;
    artist_name: string;
    song_title: string;
    event: string;
    camera_type: string;
  };
  saving: boolean;
  saved: boolean;
}

function formatDateForEdit(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function ReviewQueue() {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVideos({ status: 'needs_review', limit: 50 });
      setVideos(
        response.videos.map((video) => ({
          ...video,
          editForm: {
            perf_date: formatDateForEdit(video.perf_date),
            group_name: video.group_name || '',
            artist_name: video.artist_name || '',
            song_title: video.song_title || '',
            event: video.event ? video.event.replace('@', '') : '',
            camera_type: video.camera_type || '',
          },
          saving: false,
          saved: false,
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
  }, []);

  const handleFieldChange = (id: number, key: keyof ReviewVideo['editForm'], value: string) => {
    setVideos((prev) =>
      prev.map((video) =>
        video.id === id ? { ...video, editForm: { ...video.editForm, [key]: value } } : video,
      ),
    );
  };

  const handleSave = async (video: ReviewVideo) => {
    setVideos((prev) =>
      prev.map((item) => (item.id === video.id ? { ...item, saving: true } : item)),
    );
    try {
      await updateMetadata(video.id, {
        perf_date: video.editForm.perf_date || null,
        group_name: video.editForm.group_name || null,
        artist_name: video.editForm.artist_name || null,
        song_title: video.editForm.song_title || null,
        event: video.editForm.event ? '@' + video.editForm.event.toUpperCase() : null,
        camera_type: video.editForm.camera_type || null,
      });
      message.success(`Saved: ${video.original_title}`);
      setVideos((prev) =>
        prev.map((item) => (item.id === video.id ? { ...item, saving: false, saved: true } : item)),
      );
      setTimeout(() => {
        setVideos((prev) => prev.filter((item) => item.id !== video.id));
      }, 1200);
    } catch (err) {
      setVideos((prev) =>
        prev.map((item) => (item.id === video.id ? { ...item, saving: false } : item)),
      );
      message.error(err instanceof Error ? err.message : 'Failed to save changes');
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
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteInput
                  label="Performance Date (YYMMDD)"
                  type="groups"
                  value={video.editForm.perf_date}
                  onChange={(value) => handleFieldChange(video.id, 'perf_date', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteInput
                  label="Group Name"
                  type="groups"
                  value={video.editForm.group_name}
                  onChange={(value) => handleFieldChange(video.id, 'group_name', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteInput
                  label="Artist Name"
                  type="artists"
                  value={video.editForm.artist_name}
                  onChange={(value) => handleFieldChange(video.id, 'artist_name', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteInput
                  label="Song Title"
                  type="songs"
                  value={video.editForm.song_title}
                  onChange={(value) => handleFieldChange(video.id, 'song_title', value)}
                />
              </Col>
              <Col xs={24} md={12} lg={8}>
                <AutocompleteInput
                  label="Event"
                  type="events"
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

            <Button
              style={{ marginTop: 16 }}
              type="primary"
              loading={video.saving}
              disabled={video.saved}
              onClick={() => void handleSave(video)}
            >
              {video.saved ? 'Saved!' : 'Save & Move to New'}
            </Button>
          </Card>
        ))}
      </Space>
    </Space>
  );
}

export default ReviewQueue;
