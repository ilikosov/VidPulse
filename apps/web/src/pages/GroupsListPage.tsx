import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';
import { dictionaryApi, type DictionaryGroup, type DictionaryGroupType } from '../api/dictionary';

type GroupTypeFilter = 'all' | DictionaryGroupType;

const typeColorMap: Record<string, string> = { female: 'magenta', male: 'blue', mixed: 'purple' };

interface GroupFormValues {
  name: string;
  type: DictionaryGroupType;
  active: boolean;
}

export default function GroupsListPage() {
  const { page, limit, setPagination, searchParams, setSearchParams } =
    usePaginationSearchParams(20);
  const navigate = useNavigate();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const [items, setItems] = useState<DictionaryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DictionaryGroup | null>(null);
  const [form] = Form.useForm<GroupFormValues>();

  const q = searchParams.get('q') ?? '';
  const [total, setTotal] = useState(0);
  const type = (searchParams.get('type') as GroupTypeFilter | null) ?? 'all';

  const load = async () => {
    setLoading(true);
    try {
      const data = await dictionaryApi.getGroupsList({
        page,
        limit,
        q: q || undefined,
        type: type === 'all' ? undefined : type,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.pagination?.total ?? data.items.length);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    void load();
  }, [page, limit, q, type]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ name: '', type: 'female', active: true });
    setModalOpen(true);
  };

  const openEdit = (row: DictionaryGroup) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      type: row.type as DictionaryGroupType,
      active: row.active,
    });
    setModalOpen(true);
  };

  const submitModal = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await dictionaryApi.updateGroup(editing.id, values);
        message.success('Group updated');
      } else {
        await dictionaryApi.createGroup(values);
        message.success('Group created');
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async (row: DictionaryGroup) => {
    try {
      await dictionaryApi.deleteGroup(row.id);
      message.success('Group deleted');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete group');
    }
  };

  const columns: ColumnsType<DictionaryGroup> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        render: (_value, row) => (
          <Link to={`/dictionary/groups/${row.id}`} state={{ from }}>
            {row.display_name ?? row.name}
          </Link>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'type',
        render: (value: string) => <Tag color={typeColorMap[value] || 'default'}>{value}</Tag>,
      },
      {
        title: 'Artist count',
        dataIndex: 'artist_count',
        render: (value?: number) => value ?? '-',
      },
      { title: 'Song count', dataIndex: 'song_count', render: (value?: number) => value ?? '-' },
      { title: 'Video count', dataIndex: 'video_count', render: (value?: number) => value ?? '-' },
      {
        title: 'Aliases count',
        dataIndex: 'aliases_count',
        render: (value?: number) => value ?? '-',
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_value, row) => (
          <Space>
            <Button onClick={() => navigate(`/dictionary/groups/${row.id}`, { state: { from } })}>
              Open
            </Button>
            <Button onClick={() => openEdit(row)}>Edit</Button>
            <Popconfirm title="Delete this group?" onConfirm={() => removeGroup(row)}>
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [from, navigate],
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
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Groups Catalog
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          Add Group
        </Button>
      </Space>

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
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => setPagination({ page: nextPage, limit: nextLimit }),
        }}
      />

      <Modal
        title={editing ? 'Edit Group' : 'Add Group'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitModal}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: 'Type is required' }]}
          >
            <Select
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
                { value: 'mixed', label: 'Mixed' },
              ]}
            />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
