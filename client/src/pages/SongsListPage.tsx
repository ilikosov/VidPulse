import { Empty, Input, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { dictionaryApi, type DictionarySong } from '../api/dictionary';

export default function SongsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<DictionarySong[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');

  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 20);
  const q = searchParams.get('q') ?? '';

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await dictionaryApi.getSongsList({ page, limit, q: q || undefined });
        setItems(data.items);
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Failed to load songs');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [page, limit, q]);

  const columns: ColumnsType<DictionarySong> = useMemo(
    () => [
      {
        title: 'Title',
        dataIndex: 'title',
        render: (_v, row) => <Link to={`/songs/${row.id}`}>{row.title}</Link>,
      },
      { title: 'Artist', dataIndex: 'artist', render: (value: string | null) => value || '-' },
    ],
    [],
  );

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) =>
      v === undefined || v === '' ? params.delete(k) : params.set(k, String(v)),
    );
    setSearchParams(params);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Songs
      </Typography.Title>
      <Input.Search
        placeholder="Search by song title"
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        onSearch={() => updateParams({ q: searchDraft, page: 1 })}
        allowClear
        style={{ width: 260 }}
      />
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        locale={{ emptyText: <Empty description="No songs found" /> }}
        pagination={{
          current: page,
          pageSize: limit,
          total: items.length,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => updateParams({ page: nextPage, limit: nextLimit }),
        }}
      />
    </Space>
  );
}
