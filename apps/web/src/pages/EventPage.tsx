import { Button, Card, Descriptions, Empty, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi } from '../api/dictionary';
import AliasesEditor from '../components/AliasesEditor';
import { getBackPath } from '../utils/navigation';
import { SongLinks } from '../components/SongLinks';
import { useVideoDrawer } from '../components/VideoDrawerProvider';

export default function EventPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openVideo } = useVideoDrawer();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = `${location.pathname}${location.search}`;
  const backPath = getBackPath(location.state, '/dictionary/events');
  const tab = searchParams.get('tab') || 'overview';
  const videosPage = Number(searchParams.get('videosPage') || '1');

  const [event, setEvent] = useState<{ id: number; name: string } | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const columns: ColumnsType<Video> = useMemo(
    () => [
      {
        title: 'Title',
        dataIndex: 'original_title',
        render: (_v, row: any) => (
          <a onClick={() => openVideo(row.id)} style={{ cursor: 'pointer' }}>
            {row.original_title}
          </a>
        ),
      },
      { title: 'Group', dataIndex: 'group_name' },
      { title: 'Artist', dataIndex: 'artist_name' },
      {
        title: 'Song',
        dataIndex: 'song_title',
        render: (_v: unknown, r: any) => <SongLinks video={r} from={from} />,
      },
      { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
    ],
    [from],
  );

  useEffect(() => {
    const load = async () => {
      const [eventResponse, videosResponse] = await Promise.all([
        dictionaryApi.getEvent(id),
        dictionaryApi.getEventVideos(id, videosPage, pagination.limit),
      ]);
      setEvent(eventResponse);
      setVideos(videosResponse.videos);
      setPagination(videosResponse.pagination);
    };

    void load();
  }, [id, videosPage]);

  if (!event) return <Empty />;

  return (
    <Card
      title={<Typography.Title level={3}>Event: {event.name}</Typography.Title>}
      extra={
        <Button type="text" onClick={() => navigate(backPath)}>
          ← Back
        </Button>
      }
    >
      <Tabs
        activeKey={tab}
        onChange={(nextTab) => {
          const params = new URLSearchParams(searchParams);
          params.set('tab', nextTab);
          setSearchParams(params);
        }}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Descriptions
                bordered
                column={1}
                items={[
                  { key: 'name', label: 'Name', children: event.name },
                  { key: 'videosCount', label: 'Videos count', children: pagination.total },
                ]}
              />
            ),
          },
          {
            key: 'videos',
            label: 'Videos',
            children: (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={videos}
                pagination={{
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  onChange: (page) => {
                    const params = new URLSearchParams(searchParams);
                    params.set('videosPage', String(page));
                    setSearchParams(params);
                  },
                }}
              />
            ),
          },
          {
            key: 'aliases',
            label: 'Aliases',
            children: <AliasesEditor entityType="event" entityId={id} />,
          },
        ]}
      />
    </Card>
  );
}
