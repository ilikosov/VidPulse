import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { Alert, Button, Layout, Menu, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { fetchApi } from './api/client';
import ReviewQueue from './components/ReviewQueue';
import VideoTable from './components/VideoTable';
import { VideoDrawerProvider } from './components/VideoDrawerProvider';
import ChannelPage from './pages/ChannelPage';
import SourcesPage from './pages/SourcesPage';
import EventLogPage from './pages/EventLogPage';
import SettingsPage from './pages/SettingsPage';
import DictionaryToolsPage from './pages/DictionaryToolsPage';
import GroupPage from './pages/GroupPage';
import ArtistPage from './pages/ArtistPage';
import SongPage from './pages/SongPage';
import GroupsListPage from './pages/GroupsListPage';
import ArtistsListPage from './pages/ArtistsListPage';
import SongsListPage from './pages/SongsListPage';
import MediaLibraryPage from './pages/MediaLibraryPage';
import EventDictionaryPage from './pages/EventDictionaryPage';
import EventPage from './pages/EventPage';
import MediaLibraryOverviewPage from './pages/MediaLibraryOverviewPage';
import VideoListsPage from './pages/VideoListsPage';
import VideoListDetailsPage from './pages/VideoListDetailsPage';
import FilesPage from './pages/FilesPage';
import PlaylistPage from './pages/PlaylistPage';

const { Header, Content } = Layout;

const menuItems = [
  { key: '/videos', label: <Link to="/videos">Videos</Link> },
  { key: '/video-lists', label: <Link to="/video-lists">Video Lists</Link> },
  { key: '/files', label: <Link to="/files">Files</Link> },
  { key: '/review', label: <Link to="/review">Review Queue</Link> },
  { key: '/sources', label: <Link to="/sources">Sources</Link> },
  { key: '/dictionary', label: <Link to="/dictionary/overview">Media Library</Link> },
  { key: '/events', label: <Link to="/events">Activity Log</Link> },
  { key: '/settings', label: <Link to="/settings">Settings</Link> },
];

function RedirectEntityDetail({ entity }: { entity: 'groups' | 'artists' | 'songs' }) {
  const { id = '' } = useParams();
  return <Navigate to={`/dictionary/${entity}/${id}`} replace />;
}

type YouTubeHealthState = { ok: boolean | null; error?: string; checking: boolean };

function useYouTubeHealth() {
  const [state, setState] = useState<YouTubeHealthState>({ ok: null, checking: true });

  const check = useCallback(async () => {
    setState((s) => ({ ...s, checking: true }));
    try {
      const result = await fetchApi<{ ok: boolean; error?: string }>('/health/youtube');
      setState({ ok: result.ok, error: result.error, checking: false });
    } catch (e: any) {
      setState({
        ok: false,
        error: e?.message ?? 'Не удалось связаться с сервером',
        checking: false,
      });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { state, retry: check };
}

function App() {
  const location = useLocation();
  const { state: ytHealthState, retry: retryYtHealth } = useYouTubeHealth();
  let selectedKey = location.pathname;
  if (location.pathname.startsWith('/dictionary')) selectedKey = '/dictionary';
  else if (/^\/video-lists\/[^/]+/.test(location.pathname)) selectedKey = '/video-lists';
  else if (/^\/channels\/[^/]+/.test(location.pathname)) selectedKey = '/sources';
  else if (!menuItems.some((item) => item.key === selectedKey)) selectedKey = '/videos';

  return (
    <VideoDrawerProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            paddingInline: 24,
          }}
        >
          <Typography.Title level={4} style={{ margin: 0, color: '#eb2f96' }}>
            K-pop Archive Manager
          </Typography.Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip
              title={
                ytHealthState.ok === false
                  ? ytHealthState.error
                  : ytHealthState.ok === true
                    ? 'YouTube API доступен'
                    : 'Проверка...'
              }
            >
              <Button
                type="text"
                size="small"
                icon={
                  ytHealthState.checking ? (
                    <LoadingOutlined style={{ color: '#8c8c8c' }} />
                  ) : ytHealthState.ok ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  )
                }
                onClick={retryYtHealth}
              />
            </Tooltip>
            <Menu
              mode="horizontal"
              selectedKeys={[selectedKey]}
              items={menuItems}
              style={{ minWidth: 760 }}
            />
          </div>
        </Header>
        {ytHealthState.ok === false && (
          <Alert
            type="error"
            showIcon
            banner
            message="Ошибка подключения к YouTube API"
            description={ytHealthState.error}
            action={
              <Button size="small" onClick={retryYtHealth} loading={ytHealthState.checking}>
                Повторная проверка
              </Button>
            }
          />
        )}
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/videos" element={<VideoTable />} />
            <Route path="/video-lists" element={<VideoListsPage />} />
            <Route path="/video-lists/:id" element={<VideoListDetailsPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/channels/:id" element={<ChannelPage />} />
            <Route path="/playlists/:id" element={<PlaylistPage />} />

            <Route path="/dictionary" element={<MediaLibraryPage />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<MediaLibraryOverviewPage />} />
              <Route path="groups" element={<GroupsListPage />} />
              <Route path="groups/:id" element={<GroupPage />} />
              <Route path="artists" element={<ArtistsListPage />} />
              <Route path="artists/:id" element={<ArtistPage />} />
              <Route path="songs" element={<SongsListPage />} />
              <Route path="songs/:id" element={<SongPage />} />
              <Route path="events" element={<EventDictionaryPage />} />
              <Route path="events/:id" element={<EventPage />} />
              <Route path="tools" element={<DictionaryToolsPage />} />
            </Route>

            <Route path="/events" element={<EventLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            <Route path="/groups" element={<Navigate to="/dictionary/groups" replace />} />
            <Route path="/groups/:id" element={<RedirectEntityDetail entity="groups" />} />
            <Route path="/artists" element={<Navigate to="/dictionary/artists" replace />} />
            <Route path="/artists/:id" element={<RedirectEntityDetail entity="artists" />} />
            <Route path="/songs" element={<Navigate to="/dictionary/songs" replace />} />
            <Route path="/songs/:id" element={<RedirectEntityDetail entity="songs" />} />

            <Route path="*" element={<VideoTable />} />
          </Routes>
        </Content>
      </Layout>
    </VideoDrawerProvider>
  );
}

export default App;
