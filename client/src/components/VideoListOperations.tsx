import React from 'react';
import { Button, notification } from 'antd';
import { batchVideoOperation } from '../api/videoListsApi';

interface VideoListOperationsProps {
  listId: number;
  selectedVideoIds: number[];
  refreshVideos: () => void;
}

export default function VideoListOperations({ listId, selectedVideoIds, refreshVideos }: VideoListOperationsProps) {
  async function handleOperation(operation: string) {
    if (selectedVideoIds.length === 0) {
      notification.error({ message: 'No videos selected' });
      return;
    }
    try {
      await batchVideoOperation(listId, operation, selectedVideoIds);
      notification.success({ message: `Operation ${operation} applied` });
      refreshVideos();
    } catch (err: any) {
      notification.error({ message: err?.message || `Failed to apply ${operation}` });
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Button onClick={() => handleOperation('removeFromList')} disabled={selectedVideoIds.length === 0} style={{ marginRight: 8 }}>
        Remove from List
      </Button>
      <Button onClick={() => handleOperation('addTag')} disabled={selectedVideoIds.length === 0} style={{ marginRight: 8 }}>
        Add Tag
      </Button>
      <Button onClick={() => handleOperation('removeTag')} disabled={selectedVideoIds.length === 0} style={{ marginRight: 8 }}>
        Remove Tag
      </Button>
      <Button onClick={() => handleOperation('confirmDownload')} disabled={selectedVideoIds.length === 0} style={{ marginRight: 8 }}>
        Confirm Download
      </Button>
      <Button onClick={() => handleOperation('reparse')} disabled={selectedVideoIds.length === 0}>
        Reparse
      </Button>
    </div>
  );
}