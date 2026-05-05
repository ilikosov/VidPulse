import { Card, Descriptions, Empty, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Video } from '../api';
import { dictionaryApi, type DictionaryGroup } from '../api/dictionary';
import AliasesEditor from '../components/AliasesEditor';

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

export default function GroupPage() {
  const { id = '' } = useParams();
  const [group, setGroup] = useState<DictionaryGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const [g, response] = await Promise.all([
        dictionaryApi.getGroup(id),
        dictionaryApi.getGroupVideos(id, page, pagination.limit),
      ]);
      setGroup(g);
      setVideos(response.videos);
      setPagination(response.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, [id]);
  if (loading) return <Spin />;
  if (!group) return <Empty description="Group not found" />;

  return (
    <Card title={<Typography.Title level={3}>{group.name}</Typography.Title>}>
      <Descriptions
        bordered
        column={1}
        items={[
          { key: 'type', label: 'Type', children: <Tag>{group.type}</Tag> },
          {
            key: 'artists',
            label: 'Artists',
            children: group.artists?.length
              ? group.artists.map((a) => (
                  <Tag key={a.id}>
                    <Link to={`/artists/${a.id}`}>{a.name}</Link>
                  </Tag>
                ))
              : 'No members listed',
          },
        ]}
      />
      <AliasesEditor entityType="group" entityId={id} />
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
          onChange: (page, pageSize) => {
            setPagination((p) => ({ ...p, limit: pageSize || 20 }));
            void load(page);
          },
        }}
      />
    </Card>
  );
}
