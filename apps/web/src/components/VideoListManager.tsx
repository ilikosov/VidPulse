import React, { useState } from 'react';
import { Button, Modal, Input, notification } from 'antd';
import {
  createVideoList,
  addVideosToList,
  renameVideoList,
  deleteVideoList,
} from '../api/videoListsApi';

interface VideoListManagerProps {
  selectedVideoIds: number[];
  refreshLists: () => void;
}

export default function VideoListManager({
  selectedVideoIds,
  refreshLists,
}: VideoListManagerProps) {
  const [newListModalOpen, setNewListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  async function handleCreateList() {
    if (!newListName || selectedVideoIds.length === 0) {
      notification.error({ message: 'Enter list name and select videos' });
      return;
    }
    try {
      await createVideoList({ name: newListName, videoIds: selectedVideoIds });
      notification.success({ message: 'Video list created' });
      setNewListName('');
      setNewListModalOpen(false);
      refreshLists();
    } catch (err: any) {
      notification.error({ message: err?.message || 'Failed to create list' });
    }
  }

  return (
    <>
      <Button
        type="primary"
        onClick={() => setNewListModalOpen(true)}
        disabled={selectedVideoIds.length === 0}
      >
        Create New List
      </Button>
      <Modal
        title="Create Video List"
        open={newListModalOpen}
        onOk={handleCreateList}
        onCancel={() => setNewListModalOpen(false)}
      >
        <Input
          placeholder="List name"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
        />
      </Modal>
    </>
  );
}
