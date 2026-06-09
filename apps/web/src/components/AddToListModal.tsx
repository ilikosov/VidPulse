import { useEffect, useState } from 'react';
import { Input, Modal, Segmented, Select, Space, Tag, Typography, message } from 'antd';
import {
  addVideosToList,
  createVideoList,
  getVideoLists,
  type VideoListSummary,
} from '../api/videoListsApi';

interface AddToListModalProps {
  open: boolean;
  onClose: () => void;
  videoIds: number[];
  onSuccess?: () => void;
}

type Mode = 'existing' | 'new';

export default function AddToListModal({
  open,
  onClose,
  videoIds,
  onSuccess,
}: AddToListModalProps) {
  const [lists, setLists] = useState<VideoListSummary[]>([]);
  const [mode, setMode] = useState<Mode>('existing');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('existing');
    setSelectedListId(null);
    setNewName('');
    getVideoLists()
      .then((res) => {
        setLists(res);
        if (res.length === 0) setMode('new');
      })
      .catch(() => message.error('Failed to fetch video lists'));
  }, [open]);

  async function handleOk() {
    if (videoIds.length === 0) {
      message.error('No videos selected');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'new') {
        if (!newName.trim()) {
          message.error('Please enter a list name');
          setLoading(false);
          return;
        }
        await createVideoList({ name: newName.trim(), videoIds });
        message.success(`Created list "${newName.trim()}" with ${videoIds.length} video(s)`);
      } else {
        if (selectedListId == null) {
          message.error('Please choose a list');
          setLoading(false);
          return;
        }
        await addVideosToList(selectedListId, videoIds);
        message.success(`Added ${videoIds.length} video(s) to the list`);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      message.error(err?.message || 'Failed to add videos to list');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`Add ${videoIds.length} video(s) to a list`}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText={mode === 'new' ? 'Create & Add' : 'Add to List'}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Segmented
          block
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          options={[
            { label: 'Existing list', value: 'existing', disabled: lists.length === 0 },
            { label: 'New list', value: 'new' },
          ]}
        />

        {mode === 'existing' ? (
          <Select
            style={{ width: '100%' }}
            placeholder="Choose a list"
            value={selectedListId ?? undefined}
            onChange={(value) => setSelectedListId(value)}
            options={lists.map((list) => ({
              value: list.id,
              label: (
                <Space>
                  <Tag color={list.color}>{list.name}</Tag>
                  <Typography.Text type="secondary">
                    {list.status ?? 'empty'} · {list.countVideos}
                  </Typography.Text>
                </Space>
              ),
            }))}
          />
        ) : (
          <Input
            placeholder="New list name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={handleOk}
          />
        )}

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          All videos in a list must share one status. Adding a video with a different status will be
          rejected.
        </Typography.Text>
      </Space>
    </Modal>
  );
}
