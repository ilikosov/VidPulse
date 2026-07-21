import { useState } from 'react';
import { Alert, Button, Popconfirm, Space, Typography, message } from '@vidpulse/ui';
import { ReloadOutlined } from '@ant-design/icons';
import { toErrorMessage } from '../api/client';
import { dictionaryApi } from '../api/dictionary';

export default function MediaLibraryOverviewPage() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { summary } = await dictionaryApi.refreshKpopDictionary();
      message.success(
        `Словарь обновлён: групп +${summary.groups.inserted}/~${summary.groups.updated}, ` +
          `артистов +${summary.artists.inserted}/~${summary.artists.updated}` +
          (summary.errors.length ? `, ошибок: ${summary.errors.length}` : ''),
      );
    } catch (error) {
      message.error(toErrorMessage(error) || 'Не удалось обновить словарь');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
        <Typography.Title level={3} style={{ margin: 0 }}>
          Media Library Overview
        </Typography.Title>
        <Popconfirm
          title="Обновить словарь из источников?"
          description="Данные тянутся из Wikidata (требуется доступ к сети). Может занять время."
          okText="Обновить"
          cancelText="Отмена"
          onConfirm={() => void onRefresh()}
        >
          <Button type="primary" icon={<ReloadOutlined />} loading={refreshing}>
            Обновить словарь из источников
          </Button>
        </Popconfirm>
      </Space>
      <Alert type="info" showIcon message="Use tabs to navigate dictionary entities and tools." />
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Обновление наполняет словарь группами и участниками из внешних источников (Wikidata).
        Запускается также по расписанию, если включено (KPOP_DICT_REFRESH_ENABLED).
      </Typography.Paragraph>
    </Space>
  );
}
