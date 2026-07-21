import {
  Button,
  Card,
  Descriptions,
  Empty,
  List,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from '@vidpulse/ui';
import type { ColumnsType } from '@vidpulse/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionaryGroup, type DictionarySong } from '../api/dictionary';
import AliasesEditor from '../components/AliasesEditor';
import { getBackPath } from '../utils/navigation';
import { SongLinks } from '../components/SongLinks';
import { useVideoDrawer } from '../components/VideoDrawerProvider';

const defaultVideosLimit = 20;
const defaultSongsLimit = 10;

export default function GroupPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openVideo } = useVideoDrawer();
  const [searchParams, setSearchParams] = useSearchParams();
  const backPath = getBackPath(location.state, '/dictionary/groups');
  const from = `${location.pathname}${location.search}`;

  const tab = searchParams.get('tab') || 'overview';
  const videosPage = Number(searchParams.get('videosPage') || '1');
  const songsPage = Number(searchParams.get('songsPage') || '1');
  const videosLimit = Number(searchParams.get('videosLimit')) || defaultVideosLimit;
  const songsLimit = Number(searchParams.get('songsLimit')) || defaultSongsLimit;

  const [group, setGroup] = useState<DictionaryGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [songs, setSongs] = useState<DictionarySong[]>([]);
  const [videosPagination, setVideosPagination] = useState({
    page: 1,
    limit: defaultVideosLimit,
    total: 0,
  });
  const [songsPagination, setSongsPagination] = useState({
    page: 1,
    limit: defaultSongsLimit,
    total: 0,
  });

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === '') params.delete(k);
      else params.set(k, String(v));
    });
    setSearchParams(params);
  };

  const columns: ColumnsType<Video> = useMemo(
    () => [
      {
        title: 'Thumbnail',
        dataIndex: 'youtube_id',
        render: (youtubeId, row: any) => (
          <a onClick={() => openVideo(row.id)} style={{ cursor: 'pointer' }}>
            <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} width={120} />
          </a>
        ),
      },
      { title: 'Title', dataIndex: 'original_title' },
      {
        title: 'Group',
        dataIndex: 'group_name',
        render: (_v, r: any) =>
          r.group_id ? (
            <Link to={`/dictionary/groups/${r.group_id}`} state={{ from }}>
              {r.group_name}
            </Link>
          ) : (
            r.group_name || '-'
          ),
      },
      {
        title: 'Artist',
        dataIndex: 'artist_name',
        render: (_v, r: any) =>
          r.artist_id ? (
            <Link to={`/dictionary/artists/${r.artist_id}`} state={{ from }}>
              {r.artist_name}
            </Link>
          ) : (
            r.artist_name || '-'
          ),
      },
      {
        title: 'Song',
        dataIndex: 'song_title',
        render: (_v, r: any) => <SongLinks video={r} from={from} />,
      },
      { title: 'Event', dataIndex: 'event' },
      { title: 'Camera', dataIndex: 'camera_type' },
      { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
    ],
    [from],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [g, videosResponse, songsResponse] = await Promise.all([
          dictionaryApi.getGroup(id),
          dictionaryApi.getGroupVideos(id, videosPage, videosLimit),
          dictionaryApi.getGroupSongs(id, songsPage, songsLimit),
        ]);

        setGroup(g);
        setVideos(videosResponse.videos);
        setVideosPagination(videosResponse.pagination);
        setSongs(songsResponse.items);
        setSongsPagination(songsResponse.pagination);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, videosPage, songsPage, videosLimit, songsLimit]);

  if (loading) return <Spin />;
  if (!group) return <Empty description="Group not found" />;

  return (
    <Card
      title={
        <Typography.Title level={3}>Group: {group.display_name ?? group.name}</Typography.Title>
      }
      extra={
        <Button type="text" onClick={() => navigate(backPath)} style={{ paddingLeft: 0 }}>
          ← Back
        </Button>
      }
    >
      <Tabs
        activeKey={tab}
        onChange={(nextTab) => updateParams({ tab: nextTab })}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Descriptions
                bordered
                column={1}
                items={[
                  { key: 'type', label: 'Type', children: <Tag>{group.type}</Tag> },
                  { key: 'active', label: 'Active', children: group.active ? 'Yes' : 'No' },
                  {
                    key: 'artistsCount',
                    label: 'Artists count',
                    children: group.artist_count ?? group.artists?.length ?? 0,
                  },
                  {
                    key: 'songsCount',
                    label: 'Songs count',
                    children: group.song_count ?? songsPagination.total ?? 0,
                  },
                  {
                    key: 'videosCount',
                    label: 'Videos count',
                    children: group.video_count ?? videosPagination.total ?? 0,
                  },
                  {
                    key: 'aliasesCount',
                    label: 'Aliases count',
                    children: group.aliases_count ?? '-',
                  },
                ]}
              />
            ),
          },
          {
            key: 'artists',
            label: 'Artists',
            children: group.artists?.length ? (
              <List
                dataSource={group.artists}
                renderItem={(artist) => (
                  <List.Item>
                    <Link to={`/dictionary/artists/${artist.id}`} state={{ from }}>
                      {artist.name}
                    </Link>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No artists in this group" />
            ),
          },
          {
            key: 'songs',
            label: 'Songs',
            children: (
              <List
                dataSource={songs}
                locale={{ emptyText: <Empty description="No songs found" /> }}
                renderItem={(song) => (
                  <List.Item>
                    <Link to={`/dictionary/songs/${song.id}`} state={{ from }}>
                      {song.title}
                    </Link>
                  </List.Item>
                )}
                pagination={{
                  current: songsPagination.page,
                  pageSize: songsLimit,
                  total: songsPagination.total,
                  showSizeChanger: true,
                  onChange: (nextPage, nextPageSize) =>
                    updateParams({ songsPage: nextPage, songsLimit: nextPageSize }),
                }}
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
                locale={{ emptyText: <Empty description="No videos found" /> }}
                pagination={{
                  current: videosPagination.page,
                  pageSize: videosLimit,
                  total: videosPagination.total,
                  showSizeChanger: true,
                  onChange: (nextPage, nextPageSize) =>
                    updateParams({ videosPage: nextPage, videosLimit: nextPageSize }),
                }}
              />
            ),
          },
          {
            key: 'aliases',
            label: 'Aliases',
            children: <AliasesEditor entityType="group" entityId={id} />,
          },
        ]}
      />
    </Card>
  );
}
