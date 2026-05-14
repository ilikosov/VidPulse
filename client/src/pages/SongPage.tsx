import { Button, Card, Descriptions, Empty, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionarySong } from '../api/dictionary';
import AliasesEditor from '../components/AliasesEditor';
import { getBackPath } from '../utils/navigation';

export default function SongPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const backPath = getBackPath(location.state, '/dictionary/songs');
  const from = `${location.pathname}${location.search}`;
  const [song, setSong] = useState<DictionarySong | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

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

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([
        dictionaryApi.getSong(id),
        dictionaryApi.getSongVideos(id, page, pagination.limit),
      ]);
      setSong(s);
      setVideos(v.videos);
      setPagination(v.pagination);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(1);
  }, [id]);
  if (loading) return <Spin />;
  if (!song) return <Empty />;
  return (
    <Card title={song.title}>
      <Button
        type="text"
        onClick={() => navigate(backPath)}
        style={{ paddingLeft: 0, marginBottom: 16 }}
      >
        ← Back
      </Button>
      <Descriptions
        bordered
        column={1}
        items={[{ key: 'artist', label: 'Artist', children: song.artist }]}
      />
      <AliasesEditor entityType="song" entityId={id} />
      <Table
        rowKey="id"
        style={{ marginTop: 16 }}
        columns={columns}
        dataSource={videos}
        locale={{ emptyText: <Empty description="No videos found" /> }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          onChange: (page) => void load(page),
        }}
      />
    </Card>
  );
}
