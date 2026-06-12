import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Avatar, Button, Card, Descriptions, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getChannel, getVideos, loadMoreChannelVideos, type Channel, type Video } from '../api';
import { SongLinks } from '../components/SongLinks';
import { useVideoDrawer } from '../components/VideoDrawerProvider';
import AddToListModal from '../components/AddToListModal';

type ChannelDetails = Channel & { videoCount: number };

function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { openVideo } = useVideoDrawer();
  const location = useLocation();
  const [channel, setChannel] = useState<ChannelDetails | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const from = `${location.pathname}${location.search}`;

  const fetchData = async (nextPage = page) => {
    if (!id) return;
    setLoading(true);
    try {
      const [channelData, videosData] = await Promise.all([
        getChannel(id),
        getVideos({ page: nextPage, limit: 20, channel_id: Number(id) }),
      ]);
      setChannel(channelData);
      setVideos(videosData.videos);
      setTotal(videosData.pagination.total);
      setPage(nextPage);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load channel page');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(1);
  }, [id]);

  const onLoadMoreOldVideos = async () => {
    if (!id) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreChannelVideos(id, 50);
      message.success(`Loaded ${result.loaded} old videos`);
      await fetchData(1);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load older videos');
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
        {channel && (
          <Descriptions
            title={channel.title}
            column={1}
            extra={
              <Button
                type="primary"
                loading={loadingMore}
                onClick={() => void onLoadMoreOldVideos()}
              >
                Load More Old Videos
              </Button>
            }
          >
            <Descriptions.Item label="Thumbnail">
              <Avatar shape="square" size={64} src={channel.thumbnail_url || undefined} />
            </Descriptions.Item>
            <Descriptions.Item label="Favorite">
              {channel.is_favorite ? 'Yes' : 'No'}
            </Descriptions.Item>
            <Descriptions.Item label="Date Added">
              {new Date(channel.added_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Total Videos">{channel.videoCount}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card>
        <Typography.Title level={4}>Channel videos</Typography.Title>
        {selectedIds.length > 0 && (
          <Space style={{ marginBottom: 12 }}>
            <Typography.Text>{selectedIds.length} выбрано</Typography.Text>
            <Button onClick={() => setAddToListOpen(true)}>Добавить в список</Button>
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
            pageSize: 20,
            total,
            onChange: (nextPage) => void fetchData(nextPage),
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

export default ChannelPage;
