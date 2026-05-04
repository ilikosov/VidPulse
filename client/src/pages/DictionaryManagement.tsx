import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tabs, Upload, message, notification } from 'antd';
import { dictionaryApi } from '../api/dictionary';

export default function DictionaryManagement() {
  const [groups, setGroups] = useState<any[]>([]); const [artists, setArtists] = useState<any[]>([]); const [songs, setSongs] = useState<any[]>([]); const [events, setEvents] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null); const [modalOpen, setModalOpen] = useState(false); const [importModalOpen, setImportModalOpen] = useState(false); const [tab, setTab] = useState('groups'); const [form] = Form.useForm(); const [groupType, setGroupType] = useState('all');
  const load = async () => { setGroups(await dictionaryApi.getGroups()); setArtists(await dictionaryApi.getArtists()); setSongs(await dictionaryApi.getSongs()); setEvents(await dictionaryApi.getEvents()); };
  useEffect(() => { load().catch((e) => notification.error({ message: e.message })); }, []);
  const onSave = async () => { const v = await form.validateFields(); const id = editing?.id; const map: any = { groups: [dictionaryApi.createGroup, dictionaryApi.updateGroup], artists: [dictionaryApi.createArtist, dictionaryApi.updateArtist], songs: [dictionaryApi.createSong, dictionaryApi.updateSong], events: [dictionaryApi.createEvent, dictionaryApi.updateEvent] }; if (id) await map[tab][1](id, v); else await map[tab][0](v); setModalOpen(false); setEditing(null); form.resetFields(); await load(); message.success('Saved'); };
  const del = async (id: number) => { const map: any = { groups: dictionaryApi.deleteGroup, artists: dictionaryApi.deleteArtist, songs: dictionaryApi.deleteSong, events: dictionaryApi.deleteEvent }; await map[tab](id); await load(); message.success('Deleted'); };
  const rows = { groups, artists, songs, events }[tab].filter((x: any) => tab !== 'groups' || groupType === 'all' || x.type === groupType);
  const columns: any = {
    groups: [{ title: 'Name', dataIndex: 'name' }, { title: 'Type', dataIndex: 'type' }, { title: 'Active', dataIndex: 'active', render: (v: any) => (v ? 'Yes' : 'No') }, { title: 'Artists', dataIndex: 'artist_count' }, { title: 'Actions', render: (_: any, r: any) => <Space><Button onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>Edit</Button><Button danger onClick={() => del(r.id)}>Delete</Button></Space> }],
    artists: [{ title: 'Name', dataIndex: 'name' }, { title: 'Group ID', dataIndex: 'group_id' }, { title: 'Group', dataIndex: 'group_name' }, { title: 'Actions', render: (_: any, r: any) => <Space><Button onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>Edit</Button><Button danger onClick={() => del(r.id)}>Delete</Button></Space> }],
    songs: [{ title: 'Title', dataIndex: 'title' }, { title: 'Artist', dataIndex: 'artist' }, { title: 'Actions', render: (_: any, r: any) => <Space><Button onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>Edit</Button><Button danger onClick={() => del(r.id)}>Delete</Button></Space> }],
    events: [{ title: 'Name', dataIndex: 'name' }, { title: 'Actions', render: (_: any, r: any) => <Space><Button onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>Edit</Button><Button danger onClick={() => del(r.id)}>Delete</Button></Space> }],
  };
  const templateEntities = ['groups', 'artists', 'songs', 'events'] as const;
  const templateFormats = ['csv', 'json'] as const;
  const templateLabelMap: Record<string, string> = { groups: 'Groups', artists: 'Artists', songs: 'Songs', events: 'Events' };
  const templateUrl = (entity: string, format: string) => `${(import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api'}/dictionary/template/${entity}/${format}`;
  return <>
    <Space style={{ marginBottom: 16 }}><Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>Add</Button><Button onClick={() => setImportModalOpen(true)}>Import from File</Button>{tab === 'groups' && <Select value={groupType} onChange={setGroupType} options={[{ value: 'all', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'mixed', label: 'Mixed' }]} />}</Space>
    <Tabs activeKey={tab} onChange={setTab} items={[{ key: 'groups', label: 'Groups' }, { key: 'artists', label: 'Artists' }, { key: 'songs', label: 'Songs' }, { key: 'events', label: 'Events' }]} />
    <Table rowKey="id" dataSource={rows as any[]} columns={columns[tab]} />
    <Modal open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onSave} title={`${editing ? 'Edit' : 'Add'} ${tab}`}>
      <Form form={form} layout="vertical">
        {tab === 'groups' && <><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="type" label="Type" rules={[{ required: true }]}><Select options={[{ value: 'male' }, { value: 'female' }, { value: 'mixed' }]} /></Form.Item><Form.Item name="active" label="Active"><Select options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} /></Form.Item></>}
        {tab === 'artists' && <><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="group_id" label="Group ID" rules={[{ required: true }]}><Input /></Form.Item></>}
        {tab === 'songs' && <><Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="artist" label="Artist" rules={[{ required: true }]}><Input /></Form.Item></>}
        {tab === 'events' && <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>}
      </Form>
    </Modal>
    <Modal open={importModalOpen} onCancel={() => setImportModalOpen(false)} footer={null} title="Import Dictionary">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Upload showUploadList={false} beforeUpload={async (file) => { try { const r: any = await dictionaryApi.importFile(file as File); notification.success({ message: `Imported: ${r.inserted} inserted, ${r.updated} updated` }); setImportModalOpen(false); await load(); } catch (e: any) { notification.error({ message: e.message }); } return false; }}>
          <Button type="primary">Select File to Import</Button>
        </Upload>
        <div>
          <strong>Download templates:</strong>
          <Space direction="vertical" size={8} style={{ marginTop: 8, width: '100%' }}>
            {templateFormats.map((format) => (
              <Space key={format} wrap>
                {templateEntities.map((entity) => (
                  <Button key={`${entity}-${format}`} type="link" href={templateUrl(entity, format)} download>
                    {`${templateLabelMap[entity]} (${format.toUpperCase()})`}
                  </Button>
                ))}
              </Space>
            ))}
          </Space>
        </div>
      </Space>
    </Modal>
  </>;
}
