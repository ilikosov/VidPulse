import { Layout, Menu, Typography } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import ReviewQueue from './components/ReviewQueue';
import VideoCard from './components/VideoCard';
import VideoTable from './components/VideoTable';
import AddVideoPage from './pages/AddVideoPage';
import ChannelsPage from './pages/ChannelsPage';
import PlaylistsPage from './pages/PlaylistsPage';

const { Header, Content } = Layout;

const menuItems = [
  { key: '/videos', label: <Link to="/videos">Videos</Link> },
  { key: '/review', label: <Link to="/review">Review Queue</Link> },
  { key: '/channels', label: <Link to="/channels">Channels</Link> },
  { key: '/playlists', label: <Link to="/playlists">Playlists</Link> },
  { key: '/add-video', label: <Link to="/add-video">Add Video</Link> },
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
          <Route path="*" element={<VideoTable />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
