import { Button, Empty, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { dictionaryApi, type DictionaryGroup } from '../api/dictionary';

type GroupTypeFilter = 'all' | 'male' | 'female' | 'mixed';

const typeColorMap: Record<string, string> = { female: 'magenta', male: 'blue', mixed: 'purple' };

export default function GroupsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<DictionaryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');

  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 20);
  const q = searchParams.get('q') ?? '';
  const type = (searchParams.get('type') as GroupTypeFilter | null) ?? 'all';

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await dictionaryApi.getGroupsList({
          page,
          limit,
          q: q || undefined,
          type: type === 'all' ? undefined : type,
        });
        setItems(data.items);
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Failed to load groups');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [page, limit, q, type]);

  const columns: ColumnsType<DictionaryGroup> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        render: (_value, row) => <Link to={`/groups/${row.id}`}>{row.name}</Link>,
      },
      {
        title: 'Type',
        dataIndex: 'type',
        render: (value: string) => <Tag color={typeColorMap[value] || 'default'}>{value}</Tag>,
      },
      {
        title: 'Members count',
        dataIndex: 'artist_count',
        render: (value: number | undefined) => value ?? '-',
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_value, row) => (
          <Button onClick={() => navigate(`/groups/${row.id}`)}>View</Button>
        ),
      },
    ],
    [navigate],
  );

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === 'all') params.delete(k);
      else params.set(k, String(v));
    });
    setSearchParams(params);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Groups
      </Typography.Title>
      <Space wrap>
        <Input.Search
          placeholder="Search by group name"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onSearch={() => updateParams({ q: searchDraft, page: 1 })}
          allowClear
          style={{ width: 260 }}
        />
        <Select<GroupTypeFilter>
          value={type}
          style={{ width: 180 }}
          onChange={(value) => updateParams({ type: value, page: 1 })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
            { value: 'mixed', label: 'Mixed' },
          ]}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        locale={{ emptyText: <Empty description="No groups found" /> }}
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
