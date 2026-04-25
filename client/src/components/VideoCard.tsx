import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getVideo, updateMetadata, type Video } from '../api';
import AutocompleteInput from './AutocompleteInput';

interface EditForm {
  perf_date: string;
  group_name: string;
  artist_name: string;
  song_title: string;
  event: string;
  camera_type: string;
}

function formatDateForEdit(dateString: string | null) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function toForm(video: Video): EditForm {
  return {
    perf_date: formatDateForEdit(video.perf_date),
    group_name: video.group_name || '',
    artist_name: video.artist_name || '',
    song_title: video.song_title || '',
    event: video.event ? video.event.replace('@', '') : '',
    camera_type: video.camera_type || '',
  };
}

function formatDateDisplay(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function VideoCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchVideo = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getVideo(id);
      setVideo(data);
      setForm(toForm(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVideo();
  }, [id]);

  const handleSave = async () => {
    if (!video || !form) return;
    setSaving(true);
    try {
      await updateMetadata(video.id, {
        perf_date: form.perf_date || null,
        group_name: form.group_name || null,
        artist_name: form.artist_name || null,
        song_title: form.song_title || null,
        event: form.event ? '@' + form.event.toUpperCase() : null,
        camera_type: form.camera_type || null,
      });
      message.success('Metadata updated');
      setEditing(false);
      await fetchVideo();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" fullscreen />;
  if (error) return <Alert type="error" message={error} />;
  if (!video || !form) return <Alert type="warning" message="Video not found" />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      <Button type="link" onClick={() => navigate('/videos')} style={{ paddingLeft: 0 }}>
        ← Back to Videos
      </Button>

      <Card>
        <Flex justify="space-between" align="center" gap={12} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {video.original_title}
          </Typography.Title>
          <Tag color="magenta">{video.status}</Tag>
        </Flex>
        <Divider />

        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <img
              src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
              alt="Thumbnail"
              style={{ width: '100%', borderRadius: 8 }}
            />
            <Button type="link" href={`https://www.youtube.com/watch?v=${video.youtube_id}`} target="_blank">
              Watch on YouTube
            </Button>
          </Col>
          <Col xs={24} md={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Published Date">{formatDateDisplay(video.published_at)}</Descriptions.Item>
              <Descriptions.Item label="Channel">{video.channel_title || '-'}</Descriptions.Item>
              <Descriptions.Item label="Playlist">{video.playlist_title || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Metadata</Divider>

            {editing ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <AutocompleteInput
                  label="Performance Date (YYMMDD)"
                  type="groups"
                  placeholder="e.g., 240315"
                  value={form.perf_date}
                  onChange={(value) => setForm((prev) => (prev ? { ...prev, perf_date: value } : prev))}
                />
                <AutocompleteInput
                  label="Group Name"
                  type="groups"
                  placeholder="Enter group name"
                  value={form.group_name}
                  onChange={(value) => setForm((prev) => (prev ? { ...prev, group_name: value } : prev))}
                />
                <AutocompleteInput
                  label="Artist Name"
                  type="artists"
                  placeholder="Enter artist name"
                  value={form.artist_name}
                  onChange={(value) => setForm((prev) => (prev ? { ...prev, artist_name: value } : prev))}
                />
                <AutocompleteInput
                  label="Song Title"
                  type="songs"
                  placeholder="Enter song title"
                  value={form.song_title}
                  onChange={(value) => setForm((prev) => (prev ? { ...prev, song_title: value } : prev))}
                />
                <AutocompleteInput
                  label="Event"
                  type="events"
                  placeholder="Enter event"
                  value={form.event}
                  onChange={(value) => setForm((prev) => (prev ? { ...prev, event: value } : prev))}
                />
                <Form.Item label="Camera Type" style={{ marginBottom: 0 }}>
                  <Input
                    value={form.camera_type}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, camera_type: event.target.value } : prev))}
                  />
                </Form.Item>
                <Space>
                  <Button type="primary" onClick={() => void handleSave()} loading={saving}>
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      setForm(toForm(video));
                      setEditing(false);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </Space>
              </Space>
            ) : (
              <>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="Performance Date">{formatDateDisplay(video.perf_date)}</Descriptions.Item>
                  <Descriptions.Item label="Group">{video.group_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Artist">{video.artist_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Song">{video.song_title || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Event">{video.event || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Camera Type">{video.camera_type || '-'}</Descriptions.Item>
                </Descriptions>
                <Button type="primary" ghost style={{ marginTop: 16 }} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </>
            )}

            <Divider orientation="left">Actions</Divider>
            <Space wrap>
              <Button disabled>Confirm Download</Button>
              <Button disabled>Rename File</Button>
              <Button disabled>Mark Complete</Button>
            </Space>
            <Divider orientation="left">Preview Images</Divider>
            <Typography.Text type="secondary">No preview images available yet.</Typography.Text>
          </Col>
        </Row>
      </Card>
    </Space>
  );
}

export default VideoCard;
