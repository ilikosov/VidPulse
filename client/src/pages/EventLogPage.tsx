import { useEffect, useMemo, useState } from 'react';
import { Card, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EventLogEntry, getEvents } from '../api';

const { Text } = Typography;

const EVENT_TYPES = [
  'channel_added',
  'playlist_added',
  'video_added_manual',
  'video_added_sync',
  'sync_completed',
  'video_download_confirmed',
  'video_renamed',
  'video_completed',
  'metadata_updated',
  'error',
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  channel_added: 'geekblue',
  playlist_added: 'purple',
  video_added_manual: 'green',
  video_added_sync: 'cyan',
  sync_completed: 'blue',
  video_download_confirmed: 'gold',
  video_renamed: 'orange',
  video_completed: 'lime',
  metadata_updated: 'magenta',
  error: 'red',
};

function formatMetadata(event: EventLogEntry): string {
  if (!event.metadata) {
    return '-';
  }

  try {
    const parsed = JSON.parse(event.metadata) as Record<string, unknown>;

    if (event.event_type === 'sync_completed') {
      const channels = parsed.channelsProcessed ?? 0;
      const playlists = parsed.playlistsProcessed ?? 0;
      const newVideos = parsed.newVideosTotal ?? 0;
      return `Channels: ${channels}, Playlists: ${playlists}, New videos: ${newVideos}`;
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    return event.metadata;
  }
}

export default function EventLogPage() {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [eventType, setEventType] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const response = await getEvents({
          page,
          limit,
          event_type: eventType,
        });

        setEvents(response.events);
        setTotal(response.pagination.total);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [page, limit, eventType]);

  const columns: ColumnsType<EventLogEntry> = useMemo(
    () => [
      {
        title: 'Time',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 220,
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: 'Type',
        dataIndex: 'event_type',
        key: 'event_type',
        width: 220,
        render: (value: string) => <Tag color={EVENT_TYPE_COLORS[value] || 'default'}>{value}</Tag>,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (value: string | null) => value || '-',
      },
      {
        title: 'Metadata',
        dataIndex: 'metadata',
        key: 'metadata',
        render: (_: string | null, record) => (
          <Text style={{ whiteSpace: 'pre-wrap' }}>{formatMetadata(record)}</Text>
        ),
      },
    ],
    [],
  );

  return (
    <Card
      title="Event Log"
      extra={
        <Space>
          <span>Event Type:</span>
          <Select
            allowClear
            placeholder="All event types"
            style={{ width: 240 }}
            value={eventType}
            onChange={(value) => {
              setPage(1);
              setEventType(value);
            }}
            options={EVENT_TYPES.map((type) => ({ label: type, value: type }))}
          />
        </Space>
      }
    >
      <Table<EventLogEntry>
        rowKey="id"
        dataSource={events}
        loading={loading}
        columns={columns}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            if (nextPageSize !== limit) {
              setLimit(nextPageSize);
            }
          },
        }}
      />
    </Card>
  );
}
