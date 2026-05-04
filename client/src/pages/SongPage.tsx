import { Card, Descriptions, Empty, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionarySong } from '../api/dictionary';

const columns: ColumnsType<Video> = [
  {
    title: 'Thumbnail',
    dataIndex: 'youtube_id',
    render: (id) => <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} width={120} />,
  },
  { title: 'Title', dataIndex: 'original_title' },
  {
    title: 'Group',
    dataIndex: 'group_name',
    render: (_v, r: any) =>
      r.group_id ? <Link to={`/groups/${r.group_id}`}>{r.group_name}</Link> : r.group_name || '-',
  },
  {
    title: 'Artist',
    dataIndex: 'artist_name',
    render: (_v, r: any) =>
      r.artist_id ? (
        <Link to={`/artists/${r.artist_id}`}>{r.artist_name}</Link>
      ) : (
        r.artist_name || '-'
      ),
  },
  {
    title: 'Song',
    dataIndex: 'song_title',
    render: (_v, r: any) =>
      r.song_id ? <Link to={`/songs/${r.song_id}`}>{r.song_title}</Link> : r.song_title || '-',
  },
  { title: 'Event', dataIndex: 'event' },
  { title: 'Camera', dataIndex: 'camera_type' },
  { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
];
export default function SongPage() {
  const { id = '' } = useParams();
  const [song, setSong] = useState<DictionarySong | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
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
      <Descriptions
        bordered
        column={1}
        items={[{ key: 'artist', label: 'Artist', children: song.artist }]}
      />
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
