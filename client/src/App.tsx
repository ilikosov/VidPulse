import { Layout, Menu, Typography } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import ReviewQueue from './components/ReviewQueue';
import VideoCard from './components/VideoCard';
import VideoTable from './components/VideoTable';
import AddVideoPage from './pages/AddVideoPage';
import ChannelsPage from './pages/ChannelsPage';
import PlaylistsPage from './pages/PlaylistsPage';
import EventLogPage from './pages/EventLogPage';
import SettingsPage from './pages/SettingsPage';
import DictionaryManagement from './pages/DictionaryManagement';
import GroupPage from './pages/GroupPage';
import ArtistPage from './pages/ArtistPage';
import SongPage from './pages/SongPage';
import GroupsListPage from './pages/GroupsListPage';
import ArtistsListPage from './pages/ArtistsListPage';
import SongsListPage from './pages/SongsListPage';

const { Header, Content } = Layout;

const menuItems = [
  { key: '/videos', label: <Link to="/videos">Videos</Link> },
  { key: '/review', label: <Link to="/review">Review Queue</Link> },
  { key: '/channels', label: <Link to="/channels">Channels</Link> },
  { key: '/playlists', label: <Link to="/playlists">Playlists</Link> },
  { key: '/add-video', label: <Link to="/add-video">Add Video</Link> },
  { key: '/events', label: <Link to="/events">Event Log</Link> },
  { key: '/settings', label: <Link to="/settings">Settings</Link> },
  { key: '/dictionary', label: <Link to="/dictionary">Dictionary</Link> },
  { key: '/groups', label: <Link to="/groups">Groups</Link> },
  { key: '/artists', label: <Link to="/artists">Artists</Link> },
  { key: '/songs', label: <Link to="/songs">Songs</Link> },
];

function App() {
  const location = useLocation();
  const selectedKey = menuItems.some((item) => item.key === location.pathname)
    ? location.pathname
    : '/videos';

  return (
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
        <Menu mode="horizontal" selectedKeys={[selectedKey]} items={menuItems} style={{ minWidth: 640 }} />
      </Header>
      <Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/videos" element={<VideoTable />} />
          <Route path="/videos/:id" element={<VideoCard />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/add-video" element={<AddVideoPage />} />
          <Route path="/events" element={<EventLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dictionary" element={<DictionaryManagement />} />
          <Route path="/groups" element={<GroupsListPage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="/artists" element={<ArtistsListPage />} />
          <Route path="/artists/:id" element={<ArtistPage />} />
          <Route path="/songs" element={<SongsListPage />} />
          <Route path="/songs/:id" element={<SongPage />} />
          <Route path="*" element={<VideoTable />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
