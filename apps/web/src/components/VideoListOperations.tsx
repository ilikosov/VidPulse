import React, { useState } from 'react';
import { Button, Checkbox, Input, Modal, Space, notification, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { batchVideoOperation } from '../api/videoListsApi';
import { buildFileCommand, renameFiles } from '../api';

interface VideoListOperationsProps {
  listId: number;
  videoIds: number[];
  refreshVideos: () => void;
}

type TagMode = 'addTag' | 'removeTag';

export default function VideoListOperations({
  listId,
  videoIds,
  refreshVideos,
}: VideoListOperationsProps) {
  const [tagModal, setTagModal] = useState<TagMode | null>(null);
  const [tagName, setTagName] = useState('');
  const [excludeExistingFiles, setExcludeExistingFiles] = useState(false);

  async function run(operation: string, options?: { videoIds?: number[]; tagName?: string }) {
    try {
      await batchVideoOperation(listId, operation, options);
      notification.success({ message: `Operation ${operation} applied` });
      refreshVideos();
    } catch (err: any) {
      notification.error({ message: err?.message || `Failed to apply ${operation}` });
    }
  }

  // Every operation below applies to the whole list, so it moves through the pipeline as a unit.
  const handleStatusOp = (operation: string) => run(operation);

  const handleFileCommand = async () => {
    if (videoIds.length === 0) {
      notification.error({ message: 'Список пуст' });
      return;
    }
    try {
      const { command, excluded } = await buildFileCommand(videoIds, excludeExistingFiles);
      await navigator.clipboard.writeText(command);
      message.success(
        excluded > 0
          ? `Скопировано в буфер (исключено видео с файлами на диске: ${excluded})`
          : 'Скопировано в буфер',
      );
    } catch (err: any) {
      message.error(err?.message || 'Ошибка при формировании команды');
    }
  };

  const handleRename = async () => {
    if (videoIds.length === 0) {
      notification.error({ message: 'Список пуст' });
      return;
    }
    try {
      const { moved, skipped, errors } = await renameFiles(videoIds);
      if (errors.length > 0) {
        message.error(`Перемещено: ${moved}, ошибки: ${errors.join('; ')}`);
      } else {
        message.success(`Перемещено файлов: ${moved}, пропущено: ${skipped}`);
      }
      refreshVideos();
    } catch (err: any) {
      message.error(err?.message || 'Ошибка при перемещении файлов');
    }
  };

  const handleTagConfirm = async () => {
    if (!tagName.trim() || !tagModal) return;
    await run(tagModal, { tagName: tagName.trim() });
    setTagModal(null);
    setTagName('');
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Space wrap>
        <Button onClick={() => handleStatusOp('confirmDownload')}>Confirm Download</Button>
        <Button onClick={() => handleStatusOp('complete')}>Complete</Button>
        <Button onClick={() => handleStatusOp('ignore')}>Ignore</Button>
        <Button onClick={() => handleStatusOp('reparse')}>Reparse</Button>
        <Button onClick={() => handleStatusOp('relinkFiles')}>Обновить линковку файлов</Button>
        <Button onClick={() => setTagModal('addTag')}>Add Tag</Button>
        <Button onClick={() => setTagModal('removeTag')}>Remove Tag</Button>
        <Button
          icon={<CopyOutlined />}
          onClick={() => void handleFileCommand()}
          disabled={videoIds.length === 0}
        >
          Команда для видео
        </Button>
        <Checkbox
          checked={excludeExistingFiles}
          onChange={(e) => setExcludeExistingFiles(e.target.checked)}
        >
          Исключить видео с файлами на диске
        </Checkbox>
        <Button onClick={() => void handleRename()} disabled={videoIds.length === 0}>
          Переименовать
        </Button>
      </Space>

      <Modal
        title={tagModal === 'addTag' ? 'Add tag to all videos' : 'Remove tag from all videos'}
        open={tagModal !== null}
        onOk={handleTagConfirm}
        onCancel={() => {
          setTagModal(null);
          setTagName('');
        }}
        okButtonProps={{ disabled: !tagName.trim() }}
      >
        <Input
          placeholder="Tag name"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onPressEnter={handleTagConfirm}
        />
      </Modal>
    </div>
  );
}
