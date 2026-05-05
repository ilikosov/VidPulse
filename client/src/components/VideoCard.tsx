import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addTagToVideo,
  getVideo,
  ignoreVideo,
  llmParseVideo,
  reparseVideo,
  removeTagFromVideo,
  updateMetadata,
  type Video,
} from '../api';
import AutocompleteField from './AutocompleteField';
import { getTagColor } from '../utils/tagColors';
import { formatDuration } from '../utils/formatDuration';

const { Text, Title } = Typography;

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
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const SectionHeader = ({ title, extra }: { title: string; extra?: React.ReactNode }) => (
  <Flex align="center" gap={16} style={{ marginBottom: 16 }}>
    <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
      {title}
    </Text>
    <div style={{ flex: 1, height: 1, backgroundColor: '#f0f0f0' }} />
    {extra}
  </Flex>
);

function VideoCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  const [presetTagLoading, setPresetTagLoading] = useState<'short' | 'private' | null>(null);
  const [llmParsing, setLlmParsing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const requiresManualTagConfirmation = (tagName: string) =>
    ['short', 'private'].includes(tagName.trim().toLowerCase());

  const fetchVideo = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getVideo(id);
      setVideo(data);
      setForm(toForm(data));
      setTagSuggestions((data.tags ?? []).map((tag) => tag.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!video || !newTagName.trim()) return;
    const tagName = newTagName.trim();
    if (requiresManualTagConfirmation(tagName)) {
      Modal.confirm({
        title: `Add "${tagName}" tag?`,
        content: `This tag affects filtering and workflow. Do you want to continue?`,
        okText: 'Yes, add tag',
        cancelText: 'Cancel',
        onOk: () => handleAddTagConfirmed(tagName, true),
      });
      return;
    }
    await handleAddTagConfirmed(tagName, false);
  };

  const handleAddTagConfirmed = async (tagName: string, confirm: boolean) => {
    if (!video) return;
    setTagLoading(true);
    try {
      await addTagToVideo(video.id, tagName, confirm);
      message.success('Tag added');
      setNewTagName('');
      await fetchVideo();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setTagLoading(false);
    }
  };

  const handleAddPresetTag = async (tagName: 'short' | 'private') => {
    if (!video) return;
    Modal.confirm({
      title: `Add "${tagName}" tag?`,
      content: `This tag affects filtering and workflow. Do you want to continue?`,
      okText: 'Yes, add tag',
      cancelText: 'Cancel',
      onOk: async () => {
        setPresetTagLoading(tagName);
        try {
          await addTagToVideo(video.id, tagName, true);
          message.success(`Tag "${tagName}" added`);
          await fetchVideo();
        } catch (err) {
          message.error(err instanceof Error ? err.message : `Failed to add ${tagName} tag`);
        } finally {
          setPresetTagLoading(null);
        }
      },
    });
  };

  const handleIgnore = async () => {
    if (!video || video.status === 'ignored') return;
    Modal.confirm({
      title: 'Ignore this video?',
      content: 'Are you sure you want to ignore this video? It will be hidden from views.',
      okText: 'Ignore',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await ignoreVideo(video.id);
          message.success('Video ignored');
          await fetchVideo();
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Failed to ignore video');
        }
      },
    });
  };

  const handleLlmParse = async () => {
    if (!video) return;
    setLlmParsing(true);
    try {
      await llmParseVideo(video.id);
      message.success('LLM parse completed');
      await fetchVideo();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed LLM parse');
    } finally {
      setLlmParsing(false);
    }
  };

  const handleReparse = async () => {
    if (!video) return;
    setReparsing(true);
    try {
      await reparseVideo(video.id);
      message.success('Reparse completed');
      await fetchVideo();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to reparse video');
    } finally {
      setReparsing(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!video) return;
    setTagLoading(true);
    try {
      await removeTagFromVideo(video.id, tagId);
      message.success('Tag removed');
      await fetchVideo();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to remove tag');
    } finally {
      setTagLoading(false);
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
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <Button
        type="text"
        onClick={() => navigate('/videos')}
        style={{ paddingLeft: 0, marginBottom: 24, color: '#666' }}
      >
        ← Back to Videos
      </Button>

      <Card
        bordered={false}
        style={{
          boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Flex justify="space-between" align="flex-start" gap={12} wrap style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>
            {video.original_title}
          </Title>
          <Space>
            <Tag
              color={
                video.status === 'ignored'
                  ? 'default'
                  : video.status === 'processed'
                    ? 'success'
                    : 'magenta'
              }
              style={{ textTransform: 'capitalize', fontWeight: 500 }}
            >
              {video.status}
            </Tag>
            <Button onClick={() => void handleReparse()} loading={reparsing} size="small">
              Reparse
            </Button>
            <Button
              danger
              variant="outlined"
              onClick={() => void handleIgnore()}
              disabled={video.status === 'ignored'}
              size="small"
            >
              Ignore
            </Button>
          </Space>
        </Flex>

        <Divider style={{ margin: '0 0 24px 0' }} />

        <Row gutter={[32, 32]}>
          {/* Left Column - Thumbnail */}
          <Col xs={24} md={9} lg={8}>
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <img
                src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
                alt="Thumbnail"
                style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.4))',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    background: 'rgba(255, 0, 0, 0.9)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 6,
                  }}
                >
                  <span style={{ color: 'white', fontSize: 24, lineHeight: 1 }}>▶</span>
                </div>
              </div>
            </div>
            <Button
              type="link"
              href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              style={{ marginTop: 12, padding: 0, fontWeight: 500 }}
            >
              Open in YouTube ↗
            </Button>
          </Col>

          {/* Right Column - Details */}
          <Col
            xs={24}
            md={15}
            lg={16}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          >
            {/* Basic Info (Clean, no borders) */}
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Published">
                {formatDateDisplay(video.published_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {formatDuration(video.duration_seconds)}
              </Descriptions.Item>
              <Descriptions.Item label="Channel">{video.channel_title || '-'}</Descriptions.Item>
              <Descriptions.Item label="Playlist">{video.playlist_title || '-'}</Descriptions.Item>
            </Descriptions>

            {/* Metadata Block */}
            <div>
              <SectionHeader
                title="Metadata"
                extra={
                  !editing ? (
                    <Button type="primary" ghost size="small" onClick={() => setEditing(true)}>
                      Edit Metadata
                    </Button>
                  ) : null
                }
              />

              {editing ? (
                <div
                  style={{
                    background: '#fafafa',
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid #f0f0f0',
                    // Grid гарантирует, что вложенные Row/Col не будут схлопываться
                    display: 'grid',
                    gap: 16,
                  }}
                >
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <AutocompleteField
                        label="Performance Date (YYMMDD)"
                        type="group"
                        placeholder="e.g., 240315"
                        value={form.perf_date}
                        onChange={(value) =>
                          setForm((prev) => (prev ? { ...prev, perf_date: value } : prev))
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <AutocompleteField
                        label="Group Name"
                        type="group"
                        placeholder="Enter group name"
                        value={form.group_name}
                        onChange={(value) =>
                          setForm((prev) => (prev ? { ...prev, group_name: value } : prev))
                        }
                      />
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <AutocompleteField
                        label="Artist Name"
                        type="artist"
                        placeholder="Enter artist name"
                        value={form.artist_name}
                        onChange={(value) =>
                          setForm((prev) => (prev ? { ...prev, artist_name: value } : prev))
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <AutocompleteField
                        type="song"
                        placeholder="Enter song title"
                        value={form.song_title}
                        onChange={(value) =>
                          setForm((prev) => (prev ? { ...prev, song_title: value } : prev))
                        }
                      />
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <AutocompleteField
                        type="event"
                        placeholder="Enter event"
                        value={form.event}
                        onChange={(value) =>
                          setForm((prev) => (prev ? { ...prev, event: value } : prev))
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Camera Type" style={{ marginBottom: 0, width: '100%' }}>
                        <Input
                          placeholder="Enter camera type"
                          value={form.camera_type}
                          onChange={(event) =>
                            setForm((prev) =>
                              prev ? { ...prev, camera_type: event.target.value } : prev,
                            )
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Flex gap={12} justify="flex-end" style={{ marginTop: 8 }}>
                    <Button
                      onClick={() => {
                        setForm(toForm(video));
                        setEditing(false);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="primary" onClick={() => void handleSave()} loading={saving}>
                      Save Changes
                    </Button>
                  </Flex>
                </div>
              ) : (
                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label="Performance Date">
                    {formatDateDisplay(video.perf_date)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Group">{video.group_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Artist">{video.artist_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Song">{video.song_title || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Event">{video.event || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Camera Type">
                    {video.camera_type || '-'}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </div>

            {/* Tags Block */}
            <div>
              <SectionHeader title="Tags" />

              <div
                style={{
                  background: '#fafafa',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #f0f0f0',
                  display: 'grid',
                  gap: 16,
                }}
              >
                <Space wrap size={[8, 8]}>
                  {(video.tags ?? []).length > 0 ? (
                    video.tags?.map((tag) => (
                      <Tag
                        key={tag.id}
                        color={getTagColor(tag.name)}
                        closable
                        onClose={(event) => {
                          event.preventDefault();
                          void handleRemoveTag(tag.id);
                        }}
                        style={{ padding: '4px 12px', borderRadius: 4 }}
                      >
                        {tag.name}
                      </Tag>
                    ))
                  ) : (
                    <Text type="secondary" style={{ fontStyle: 'italic' }}>
                      No tags added yet
                    </Text>
                  )}
                </Space>

                <Space wrap size={8}>
                  <Tooltip title="Mark as a Shorts video">
                    <Button
                      size="small"
                      icon={<span style={{ color: '#52c41a' }}>●</span>}
                      style={{ borderColor: '#b7eb8f', color: '#389e0d', background: '#f6ffed' }}
                      onClick={() => void handleAddPresetTag('short')}
                      loading={presetTagLoading === 'short'}
                      disabled={presetTagLoading !== null}
                    >
                      Shorts
                    </Button>
                  </Tooltip>
                  <Tooltip title="Mark as a Private/Unlisted video">
                    <Button
                      size="small"
                      icon={<span style={{ color: '#fa8c16' }}>●</span>}
                      style={{ borderColor: '#ffd591', color: '#d46b08', background: '#fff7e6' }}
                      onClick={() => void handleAddPresetTag('private')}
                      loading={presetTagLoading === 'private'}
                      disabled={presetTagLoading !== null}
                    >
                      Private
                    </Button>
                  </Tooltip>
                </Space>

                <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
                  <Select
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    value={newTagName || undefined}
                    placeholder="Add custom tag..."
                    options={tagSuggestions.map((name) => ({ value: name, label: name }))}
                    onChange={(value) => setNewTagName(value || '')}
                    onSearch={(value) => setNewTagName(value)}
                  />
                  <Button type="primary" onClick={() => void handleAddTag()} loading={tagLoading}>
                    Add
                  </Button>
                </Space.Compact>
              </div>
            </div>

            {/* Actions Block */}
            <div>
              <SectionHeader title="Actions" />
              <Space wrap>
                <Button onClick={() => void handleLlmParse()} loading={llmParsing}>
                  ✨ LLM Parse Metadata
                </Button>
              </Space>
            </div>

            {/* Previews Block */}
            <div>
              <SectionHeader title="Preview Images" />
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">No preview images generated yet</Text>}
              />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default VideoCard;
