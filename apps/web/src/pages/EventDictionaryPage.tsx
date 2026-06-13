import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Link, useLocation } from 'react-router-dom';
import { usePaginationSearchParams } from '../hooks/usePaginationSearchParams';
import { dictionaryApi } from '../api/dictionary';

export default function EventDictionaryPage() {
  const { page, limit, setPagination, searchParams, setSearchParams } = usePaginationSearchParams();
  const [items, setItems] = useState<
    Array<{ id: number; name: string; video_count?: number; aliases_count?: number }>
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const [form] = Form.useForm<{ name: string }>();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const q = searchParams.get('q') ?? '';

  const load = async () => {
    setLoading(true);
    try {
      const res = await dictionaryApi.getEventsList({ page, limit, q: q || undefined });
      setItems(res.items as any);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);
  useEffect(() => {
    void load();
  }, [page, limit, q]);

  const columns: ColumnsType<any> = useMemo(
    () => [
      {
        title: 'Event / Location',
        dataIndex: 'name',
        render: (_: any, row: any) => (
          <Link to={`/dictionary/events/${row.id}`} state={{ from }}>
            {row.name}
          </Link>
        ),
      },
      { title: 'Videos count', dataIndex: 'video_count', render: (v: any) => v ?? '-' },
      { title: 'Aliases count', dataIndex: 'aliases_count', render: (v: any) => v ?? '-' },
      {
        title: 'Actions',
        render: (_: any, row: any) => (
          <Space>
            <Button
              onClick={() => {
                setEditing(row);
                form.setFieldsValue({ name: row.name });
                setOpen(true);
              }}
            >
              Edit
            </Button>
            <Popconfirm
              title="Delete event?"
              onConfirm={async () => {
                await dictionaryApi.deleteEvent(row.id);
                await load();
              }}
            >
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [from],
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Events / Locations
        </Typography.Title>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setOpen(true);
          }}
        >
          Add Event
        </Button>
      </Space>
      <Input.Search
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        onSearch={() => {
          const p = new URLSearchParams(searchParams);
          if (searchDraft) p.set('q', searchDraft);
          else p.delete('q');
          p.set('page', '1');
          setSearchParams(p);
        }}
        placeholder="Search events/locations"
        style={{ width: 280 }}
      />
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        locale={{ emptyText: <Empty description="No events found" /> }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          onChange: (np, nl) => setPagination({ page: np, limit: nl }),
        }}
      />
      <Modal
        open={open}
        title={editing ? 'Edit Event' : 'Add Event'}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          setSaving(true);
          try {
            if (editing) await dictionaryApi.updateEvent(editing.id, v);
            else await dictionaryApi.createEvent(v);
            setOpen(false);
            await load();
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
