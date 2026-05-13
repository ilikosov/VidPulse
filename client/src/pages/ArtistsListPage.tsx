import { Empty, Input, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';
import { dictionaryApi, type DictionaryArtist } from '../api/dictionary';

export default function ArtistsListPage() {
  const { page, limit, setPagination, searchParams, setSearchParams } =
    usePaginationSearchParams(20);
  const [items, setItems] = useState<DictionaryArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  const q = searchParams.get('q') ?? '';
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await dictionaryApi.getArtistsList({ page, limit, q: q || undefined });
        setItems(data.items);
        setTotal(data.pagination?.total ?? data.items.length);
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Failed to load artists');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [page, limit, q]);

  const columns: ColumnsType<DictionaryArtist> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        render: (_v, row) => (
          <Link to={`/artists/${row.id}`} state={{ from }}>
            {row.name}
          </Link>
        ),
      },
      {
        title: 'Group',
        dataIndex: 'group_name',
        render: (_v, row) =>
          row.group_id ? (
            <Link to={`/groups/${row.group_id}`} state={{ from }}>
              {row.group_name}
            </Link>
          ) : (
            '-'
          ),
      },
    ],
    [from],
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
        Artists
      </Typography.Title>
      <Input.Search
        placeholder="Search by artist"
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
        locale={{ emptyText: <Empty description="No artists found" /> }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => setPagination({ page: nextPage, limit: nextLimit }),
        }}
      />
    </Space>
  );
}
