import { Card, Descriptions, Empty, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionaryArtist } from '../api/dictionary';

const columns: ColumnsType<Video> = [
  { title: 'Thumbnail', dataIndex: 'youtube_id', render: (id) => <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} width={120} /> },
  { title: 'Title', dataIndex: 'original_title' }, { title: 'Group', dataIndex: 'group_name', render: (_v, r: any) => r.group_id ? <Link to={`/groups/${r.group_id}`}>{r.group_name}</Link> : (r.group_name || '-') }, { title: 'Artist', dataIndex: 'artist_name', render: (_v, r: any) => r.artist_id ? <Link to={`/artists/${r.artist_id}`}>{r.artist_name}</Link> : (r.artist_name || '-') }, { title: 'Song', dataIndex: 'song_title', render: (_v, r: any) => r.song_id ? <Link to={`/songs/${r.song_id}`}>{r.song_title}</Link> : (r.song_title || '-') }, { title: 'Event', dataIndex: 'event' }, { title: 'Camera', dataIndex: 'camera_type' }, { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
];
export default function ArtistPage() { const { id = '' } = useParams(); const [artist, setArtist] = useState<DictionaryArtist | null>(null); const [videos, setVideos] = useState<Video[]>([]); const [loading, setLoading] = useState(true); const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const load = async (page = 1) => { setLoading(true); try { const [a, v] = await Promise.all([dictionaryApi.getArtist(id), dictionaryApi.getArtistVideos(id, page, pagination.limit)]); setArtist(a); setVideos(v.videos); setPagination(v.pagination); } finally { setLoading(false); } };
  useEffect(() => { void load(1); }, [id]); if (loading) return <Spin />; if (!artist) return <Empty />;
  return <Card title={artist.name}><Descriptions bordered column={1} items={[{ key: 'group', label: 'Group', children: artist.group_id ? <Link to={`/groups/${artist.group_id}`}>{artist.group_name}</Link> : '-' }]} /><Table rowKey='id' style={{ marginTop: 16 }} columns={columns} dataSource={videos} locale={{ emptyText: <Empty description='No videos found' /> }} pagination={{ current: pagination.page, pageSize: pagination.limit, total: pagination.total, onChange: (page) => void load(page) }} /></Card>; }
