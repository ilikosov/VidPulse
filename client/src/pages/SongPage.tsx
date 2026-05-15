import { Button, Card, Descriptions, Empty, List, Spin, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionaryArtist, type DictionarySong } from '../api/dictionary';
import AliasesEditor from '../components/AliasesEditor';
import { getBackPath } from '../utils/navigation';

const defaultVideosLimit = 20;

export default function SongPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const backPath = getBackPath(location.state, '/dictionary/songs');
  const from = `${location.pathname}${location.search}`;

  const tab = searchParams.get('tab') || 'overview';
  const videosPage = Number(searchParams.get('videosPage') || '1');

  const [song, setSong] = useState<DictionarySong | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [linkedArtists, setLinkedArtists] = useState<DictionaryArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosPagination, setVideosPagination] = useState({
    page: 1,
    limit: defaultVideosLimit,
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
          <Link to={`/videos/${r.id}`} state={{ from }}>
            <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} width={120} />
          </Link>
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
        render: (_v, r: any) =>
          r.song_id ? (
            <Link to={`/dictionary/songs/${r.song_id}`} state={{ from }}>
              {r.song_title}
            </Link>
          ) : (
            r.song_title || '-'
          ),
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
        const [songResponse, videosResponse] = await Promise.all([
          dictionaryApi.getSong(id),
          dictionaryApi.getSongVideos(id, videosPage, videosPagination.limit),
        ]);

        setSong(songResponse);
        setVideos(videosResponse.videos);
        setVideosPagination(videosResponse.pagination);

        if (songResponse.artist) {
          const artistsResponse = await dictionaryApi.getArtistsList({
            q: songResponse.artist,
            page: 1,
            limit: 20,
          });
          const matched = (artistsResponse.items || []).filter(
            (artist) => artist.name.toLowerCase() === songResponse.artist?.toLowerCase(),
          );
          setLinkedArtists(matched);
        } else {
          setLinkedArtists([]);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, videosPage]);

  if (loading) return <Spin />;
  if (!song) return <Empty />;

  const overviewGroup = song.group_id
    ? { id: song.group_id, name: song.group_name }
    : linkedArtists.find((artist) => artist.group_id)?.group_id
      ? {
          id: linkedArtists.find((artist) => artist.group_id)?.group_id,
          name: linkedArtists.find((artist) => artist.group_id)?.group_name,
        }
      : null;

  return (
    <Card
      title={<Typography.Title level={3}>Song: {song.title}</Typography.Title>}
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
                  { key: 'title', label: 'Title', children: song.title },
                  {
                    key: 'artist',
                    label: 'Artist',
                    children: song.artist_id ? (
                      <Link to={`/dictionary/artists/${song.artist_id}`} state={{ from }}>
                        {song.artist_name || song.artist}
                      </Link>
                    ) : (
                      song.artist || '-'
                    ),
                  },
                  {
                    key: 'group',
                    label: 'Group',
                    children: overviewGroup?.id ? (
                      <Link to={`/dictionary/groups/${overviewGroup.id}`} state={{ from }}>
                        {overviewGroup.name || '-'}
                      </Link>
                    ) : (
                      '-'
                    ),
                  },
                  { key: 'aliases', label: 'Aliases', children: song.aliases_count ?? '-' },
                  {
                    key: 'videosCount',
                    label: 'Videos count',
                    children: song.videos_count ?? videosPagination.total,
                  },
                ]}
              />
            ),
          },
          {
            key: 'artists',
            label: 'Artists',
            children: linkedArtists.length ? (
              <List
                dataSource={linkedArtists}
                renderItem={(artist) => (
                  <List.Item>
                    <Link to={`/dictionary/artists/${artist.id}`} state={{ from }}>
                      {artist.name}
                    </Link>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No linked artists found" />
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
                  pageSize: videosPagination.limit,
                  total: videosPagination.total,
                  onChange: (nextPage) => updateParams({ videosPage: nextPage }),
                }}
              />
            ),
          },
          {
            key: 'aliases',
            label: 'Aliases',
            children: <AliasesEditor entityType="song" entityId={id} />,
          },
        ]}
      />
    </Card>
  );
}
