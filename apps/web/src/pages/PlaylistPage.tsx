import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Avatar, Button, Card, Descriptions, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getPlaylist,
  getVideos,
  loadMorePlaylistVideos,
  reparseBatch,
  syncPlaylist,
  type Playlist,
  type Video,
} from '../api';
import { SongLinks } from '../components/SongLinks';
import { useVideoDrawer } from '../components/VideoDrawerProvider';
import AddToListModal from '../components/AddToListModal';

type PlaylistDetails = Playlist & { videoCount: number; hasMore: boolean };

function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const { openVideo } = useVideoDrawer();
  const location = useLocation();
  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [reparseLoading, setReparseLoading] = useState(false);
  const from = `${location.pathname}${location.search}`;

  const fetchData = async (nextPage = page, nextLimit = limit) => {
    if (!id) return;
    setLoading(true);
    try {
      const [playlistData, videosData] = await Promise.all([
        getPlaylist(id),
        getVideos({ page: nextPage, limit: nextLimit, playlist_id: Number(id) }),
      ]);
      setPlaylist(playlistData);
      setVideos(videosData.videos);
      setTotal(videosData.pagination.total);
      setPage(nextPage);
      setLimit(nextLimit);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(1);
  }, [id]);

  const onSync = async () => {
    if (!id) return;
    setSyncing(true);
    try {
      const result = await syncPlaylist(id);
      message.success(`Загружено ${result.loaded} новых видео из ${result.total}`);
      await fetchData(1);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  const onLoadMore = async () => {
    if (!id) return;
    setLoadingMore(true);
    try {
      const result = await loadMorePlaylistVideos(id);
      message.success(`Загружено ${result.loaded} предыдущих видео`);
      await fetchData(1);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Не удалось загрузить предыдущие видео',
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const columns: ColumnsType<Video> = [
    {
      title: 'Thumbnail',
      dataIndex: 'youtube_id',
      render: (youtubeId: string) => (
        <Avatar
          shape="square"
          size={56}
          src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
        />
      ),
    },
    { title: 'Original Title', dataIndex: 'original_title' },
    {
      title: 'Group',
      dataIndex: 'group_name',
      render: (_value: string | null | undefined, row: Video) =>
        row.group_name ? (
          row.group_id ? (
            <Link to={`/dictionary/groups/${row.group_id}`} state={{ from }}>
              {row.group_name}
            </Link>
          ) : (
            row.group_name
          )
        ) : (
          '-'
        ),
    },
    {
      title: 'Artist',
      dataIndex: 'artist_name',
      render: (_value: string | null | undefined, row: Video) =>
        row.artist_name ? (
          row.artist_id ? (
            <Link to={`/dictionary/artists/${row.artist_id}`} state={{ from }}>
              {row.artist_name}
            </Link>
          ) : (
            row.artist_name
          )
        ) : (
          '-'
        ),
    },
    {
      title: 'Song',
      dataIndex: 'song_title',
      render: (_value: string | null | undefined, row: Video) => (
        <SongLinks video={row} from={from} />
      ),
    },
    { title: 'Event', dataIndex: 'event', render: (value?: string | null) => value || '-' },
    { title: 'Camera', dataIndex: 'camera_type', render: (value?: string | null) => value || '-' },
    { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card loading={loading}>
        {playlist && (
          <Descriptions
            title={playlist.title}
            column={1}
            extra={
              <Space>
                {playlist.hasMore && (
                  <Button loading={loadingMore} onClick={() => void onLoadMore()}>
                    Загрузить предыдущие видео
                  </Button>
                )}
                <Button type="primary" loading={syncing} onClick={() => void onSync()}>
                  Синхронизировать
                </Button>
              </Space>
            }
          >
            <Descriptions.Item label="YouTube ID">{playlist.youtube_id}</Descriptions.Item>
            <Descriptions.Item label="Добавлен">
              {new Date(playlist.added_at).toLocaleString()}
            </Descriptions.Item>
            {playlist.last_checked_at && (
              <Descriptions.Item label="Последняя проверка">
                {new Date(playlist.last_checked_at).toLocaleString()}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Всего видео">{playlist.videoCount}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card>
        <Typography.Title level={4}>Видео плейлиста</Typography.Title>
        {selectedIds.length > 0 && (
          <Space style={{ marginBottom: 12 }}>
            <Typography.Text>{selectedIds.length} выбрано</Typography.Text>
            <Button onClick={() => setAddToListOpen(true)}>Добавить в список</Button>
            <Button
              loading={reparseLoading}
              onClick={async () => {
                setReparseLoading(true);
                try {
                  const result = await reparseBatch(selectedIds);
                  message.success(`Re-parse завершён для ${result.updated} видео`);
                  void fetchData(page);
                } catch (err: any) {
                  message.error(err?.message || 'Re-parse не удался');
                } finally {
                  setReparseLoading(false);
                }
              }}
            >
              Re-parse
            </Button>
            <Button onClick={() => setSelectedIds([])}>Снять выбор</Button>
          </Space>
        )}
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={videos}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
          onRow={(record) => ({
            onClick: () => openVideo(record.id, () => fetchData(page)),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => void fetchData(nextPage, nextPageSize),
          }}
        />
      </Card>
      <AddToListModal
        open={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        videoIds={selectedIds}
        onSuccess={() => setSelectedIds([])}
      />
    </Space>
  );
}

export default PlaylistPage;
