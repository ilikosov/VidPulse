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
import {
  dictionaryApi,
  type DictionaryArtist,
  type DictionaryGroup,
  type DictionarySong,
} from '../api/dictionary';

interface SongFormValues {
  title: string;
  artist_id?: number;
  artist?: string;
  group_id?: number;
}

export default function SongsListPage() {
  const { page, limit, setPagination, searchParams, setSearchParams } =
    usePaginationSearchParams(20);
  const [items, setItems] = useState<DictionarySong[]>([]);
  const [groups, setGroups] = useState<DictionaryGroup[]>([]);
  const [artists, setArtists] = useState<DictionaryArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DictionarySong | null>(null);
  const [total, setTotal] = useState(0);
  const [form] = Form.useForm<SongFormValues>();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  const q = searchParams.get('q') ?? '';
  const groupId = searchParams.get('group_id');
  const artistId = searchParams.get('artist_id');

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === '') params.delete(k);
      else params.set(k, String(v));
    });
    setSearchParams(params);
  };

  const loadRefData = async () => {
    try {
      const [groupsRes, artistsRes] = await Promise.all([
        dictionaryApi.getGroupsList({ page: 1, limit: 1000 }),
        dictionaryApi.getArtistsList({ page: 1, limit: 1000 }),
      ]);
      setGroups(groupsRes.items || []);
      setArtists(artistsRes.items || []);
    } catch {
      setGroups([]);
      setArtists([]);
    }
  };

  const loadSongs = async () => {
    setLoading(true);
    try {
      const selectedArtistId = artistId ? Number(artistId) : undefined;
      const selectedGroupId = groupId ? Number(groupId) : undefined;

      if (selectedArtistId || selectedGroupId) {
        const allSongs = await dictionaryApi.getSongs();
        const selectedArtist = artists.find((artist) => artist.id === selectedArtistId);
        const artistNames = selectedGroupId
          ? new Set(
              artists
                .filter((artist) => artist.group_id === selectedGroupId)
                .map((artist) => artist.name),
            )
          : null;

        const filtered = allSongs.filter((song) => {
          const matchQ = q ? song.title.toLowerCase().includes(q.toLowerCase()) : true;
          const matchArtist = selectedArtist ? song.artist === selectedArtist.name : true;
          const matchGroup = artistNames
            ? song.artist
              ? artistNames.has(song.artist)
              : false
            : true;
          return matchQ && matchArtist && matchGroup;
        });

        const offset = (page - 1) * limit;
        setItems(filtered.slice(offset, offset + limit));
        setTotal(filtered.length);
      } else {
        const data = await dictionaryApi.getSongsList({ page, limit, q: q || undefined });
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.pagination?.total ?? data.items.length);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    void loadRefData();
  }, []);

  useEffect(() => {
    void loadSongs();
  }, [page, limit, q, groupId, artistId, artists.length]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ title: '', group_id: groupId ? Number(groupId) : undefined });
    setModalOpen(true);
  };

  const openEdit = (song: DictionarySong) => {
    setEditing(song);
    const linkedArtist = artists.find((artist) => artist.name === song.artist);
    form.setFieldsValue({
      title: song.title,
      artist_id: song.artist_id ?? linkedArtist?.id,
      artist: song.artist ?? undefined,
      group_id: song.group_id ?? linkedArtist?.group_id,
    });
    setModalOpen(true);
  };

  const submitModal = async () => {
    const values = await form.validateFields();
    const selectedArtist = artists.find((artist) => artist.id === values.artist_id);
    const artistName = selectedArtist?.name || values.artist;
    if (!artistName) {
      message.error('Artist is required');
      return;
    }

    setSaving(true);
    try {
      const payload = { title: values.title, artist: artistName };
      if (editing) {
        await dictionaryApi.updateSong(editing.id, payload);
        message.success('Song updated');
      } else {
        await dictionaryApi.createSong(payload);
        message.success('Song created');
      }
      setModalOpen(false);
      await loadSongs();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save song');
    } finally {
      setSaving(false);
    }
  };

  const removeSong = async (song: DictionarySong) => {
    try {
      await dictionaryApi.deleteSong(song.id);
      message.success('Song deleted');
      await loadSongs();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete song');
    }
  };

  const columns: ColumnsType<DictionarySong> = useMemo(
    () => [
      {
        title: 'Song title',
        dataIndex: 'title',
        render: (_v, row) => (
          <Link to={`/dictionary/songs/${row.id}`} state={{ from }}>
            {row.display_name ?? row.title}
          </Link>
        ),
      },
      {
        title: 'Artist',
        dataIndex: 'artist',
        render: (_v, row) => {
          if (row.artist_id) {
            return (
              <Link to={`/dictionary/artists/${row.artist_id}`} state={{ from }}>
                {row.artist_name || row.artist || '-'}
              </Link>
            );
          }
          return row.artist || '-';
        },
      },
      {
        title: 'Group',
        dataIndex: 'group_name',
        render: (_v, row) => {
          if (row.group_id) {
            return (
              <Link to={`/dictionary/groups/${row.group_id}`} state={{ from }}>
                {row.group_name || '-'}
              </Link>
            );
          }
          return row.group_name || '-';
        },
      },
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
            <Popconfirm title="Delete this song?" onConfirm={() => removeSong(row)}>
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
          Songs Catalog
        </Typography.Title>
        <Button type="primary" onClick={openCreate}>
          Add Song
        </Button>
      </Space>

      <Space wrap>
        <Input.Search
          placeholder="Search by song title"
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
          style={{ width: 240 }}
          onChange={(value) => updateParams({ group_id: value, page: 1 })}
          options={groups.map((group) => ({ value: group.id, label: group.name }))}
        />
        <Select
          allowClear
          placeholder="Filter by artist"
          value={artistId ? Number(artistId) : undefined}
          style={{ width: 240 }}
          onChange={(value) => updateParams({ artist_id: value, page: 1 })}
          options={artists.map((artist) => ({ value: artist.id, label: artist.name }))}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        locale={{ emptyText: <Empty description="No songs found" /> }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => setPagination({ page: nextPage, limit: nextLimit }),
        }}
      />

      <Modal
        title={editing ? 'Edit Song' : 'Add Song'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitModal}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="artist_id" label="Artist (dictionary)">
            <Select
              allowClear
              options={artists.map((artist) => ({ value: artist.id, label: artist.name }))}
            />
          </Form.Item>
          <Form.Item name="artist" label="Artist (legacy string)">
            <Input placeholder="Use when backend does not support artist_id" />
          </Form.Item>
          <Form.Item name="group_id" label="Group (optional)">
            <Select
              allowClear
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
