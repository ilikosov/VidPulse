import { Button, Card, Descriptions, Empty, List, Spin, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionaryArtist, type DictionarySong } from '../api/dictionary';
import AliasesEditor from '../components/AliasesEditor';
import { getBackPath } from '../utils/navigation';
import { SongLinks } from '../components/SongLinks';
import { useVideoDrawer } from '../components/VideoDrawerProvider';

const defaultVideosLimit = 20;
const defaultSongsLimit = 10;

export default function ArtistPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { openVideo } = useVideoDrawer();
  const [searchParams, setSearchParams] = useSearchParams();
  const backPath = getBackPath(location.state, '/dictionary/artists');
  const from = `${location.pathname}${location.search}`;

  const tab = searchParams.get('tab') || 'overview';
  const videosPage = Number(searchParams.get('videosPage') || '1');
  const songsPage = Number(searchParams.get('songsPage') || '1');
  const videosLimit = Number(searchParams.get('videosLimit')) || defaultVideosLimit;
  const songsLimit = Number(searchParams.get('songsLimit')) || defaultSongsLimit;

  const [artist, setArtist] = useState<DictionaryArtist | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [songs, setSongs] = useState<DictionarySong[]>([]);
  const [loading, setLoading] = useState(true);
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
        render: (youtubeId, r: any) => (
          <a onClick={() => openVideo(r.id)} style={{ cursor: 'pointer' }}>
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
        const a = await dictionaryApi.getArtist(id);
        const [videosResponse, songsResponse] = await Promise.all([
          dictionaryApi.getArtistVideos(id, videosPage, videosLimit),
          dictionaryApi.getArtistSongs(id, songsPage, songsLimit),
        ]);
        setArtist(a);
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
  if (!artist) return <Empty />;

  return (
    <Card
      title={
        <Typography.Title level={3}>Artist: {artist.display_name ?? artist.name}</Typography.Title>
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
                  { key: 'name', label: 'Name', children: artist.name },
                  {
                    key: 'group',
                    label: 'Group',
                    children: artist.group_id ? (
                      <Link to={`/dictionary/groups/${artist.group_id}`} state={{ from }}>
                        {artist.group_name}
                      </Link>
                    ) : (
                      '-'
                    ),
                  },
                  {
                    key: 'songsCount',
                    label: 'Songs count',
                    children: artist.songs_count ?? songsPagination.total,
                  },
                  {
                    key: 'videosCount',
                    label: 'Videos count',
                    children: artist.videos_count ?? videosPagination.total,
                  },
                  {
                    key: 'aliasesCount',
                    label: 'Aliases count',
                    children: artist.aliases_count ?? '-',
                  },
                ]}
              />
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
            children: <AliasesEditor entityType="artist" entityId={id} />,
          },
        ]}
      />
    </Card>
  );
}
