import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';
import { dictionaryApi, type DictionaryArtist, type DictionaryGroup } from '../api/dictionary';

interface ArtistFormValues {
  name: string;
  group_id: number;
}

export default function ArtistsListPage() {
  const { page, limit, setPagination, searchParams, setSearchParams } =
    usePaginationSearchParams(20);
  const [items, setItems] = useState<DictionaryArtist[]>([]);
  const [groups, setGroups] = useState<DictionaryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DictionaryArtist | null>(null);
  const [form] = Form.useForm<ArtistFormValues>();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  const q = searchParams.get('q') ?? '';
  const groupId = searchParams.get('group_id');
  const [total, setTotal] = useState(0);

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === '') params.delete(k);
      else params.set(k, String(v));
    });
    setSearchParams(params);
  };

  const loadArtists = async () => {
    setLoading(true);
    try {
      const data = await dictionaryApi.getArtistsList({
        page,
        limit,
        q: q || undefined,
        group_id: groupId ? Number(groupId) : undefined,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.pagination?.total ?? data.items.length);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load artists');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await dictionaryApi.getGroupsList({ page: 1, limit: 1000 });
      setGroups(data.items || []);
    } catch {
      setGroups([]);
    }
  };

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    void loadArtists();
  }, [page, limit, q, groupId]);

  useEffect(() => {
    void loadGroups();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ name: '', group_id: Number(groupId) || groups[0]?.id });
    setModalOpen(true);
  };

  const openEdit = (artist: DictionaryArtist) => {
    setEditing(artist);
    form.setFieldsValue({ name: artist.name, group_id: artist.group_id });
    setModalOpen(true);
  };

  const submitModal = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await dictionaryApi.updateArtist(editing.id, values);
        message.success('Artist updated');
      } else {
        await dictionaryApi.createArtist(values);
        message.success('Artist created');
      }
      setModalOpen(false);
      await loadArtists();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save artist');
    } finally {
      setSaving(false);
    }
  };

  const removeArtist = async (artist: DictionaryArtist) => {
    try {
      await dictionaryApi.deleteArtist(artist.id);
      message.success('Artist deleted');
      await loadArtists();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete artist');
    }
  };

  const columns: ColumnsType<DictionaryArtist> = useMemo(
    () => [
      {
        title: 'Artist',
        dataIndex: 'name',
        render: (_v, row) => (
          <Link to={`/dictionary/artists/${row.id}`} state={{ from }}>
            {row.display_name ?? row.name}
          </Link>
        ),
      },
      {
        title: 'Group',
        dataIndex: 'group_name',
        render: (_v, row) =>
          row.group_id ? (
            <Link to={`/dictionary/groups/${row.group_id}`} state={{ from }}>
              {row.group_name}
            </Link>
          ) : (
            '-'
          ),
      },
      { title: 'Songs count', dataIndex: 'songs_count', render: (value?: number) => value ?? '-' },
      {
        title: 'Videos count',
        dataIndex: 'videos_count',
        render: (value?: number) => value ?? '-',
      },
      {
        title: 'Aliases count',
        dataIndex: 'aliases_count',
        render: (value?: number) => value ?? '-',
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_v, row) => (
          <Space>
            <Button onClick={() => openEdit(row)}>Edit</Button>
            <Popconfirm title="Delete this artist?" onConfirm={() => removeArtist(row)}>
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [from],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Artists Catalog
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          Add Artist
        </Button>
      </Space>

      <Space wrap>
        <Input.Search
          placeholder="Search by artist"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onSearch={() => updateParams({ q: searchDraft, page: 1 })}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          allowClear
          placeholder="Filter by group"
          value={groupId ? Number(groupId) : undefined}
          style={{ width: 260 }}
          onChange={(value) => updateParams({ group_id: value, page: 1 })}
          options={groups.map((group) => ({ value: group.id, label: group.name }))}
        />
      </Space>

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

      <Modal
        title={editing ? 'Edit Artist' : 'Add Artist'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitModal}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Artist"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="group_id"
            label="Group"
            rules={[{ required: true, message: 'Group is required' }]}
          >
            <Select options={groups.map((group) => ({ value: group.id, label: group.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
