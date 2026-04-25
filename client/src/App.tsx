import { Layout, Menu, Typography } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import ReviewQueue from './components/ReviewQueue';
import VideoCard from './components/VideoCard';
import VideoTable from './components/VideoTable';

const { Header, Content } = Layout;

const menuItems = [
  { key: '/videos', label: <Link to="/videos">Videos</Link> },
  { key: '/review', label: <Link to="/review">Review Queue</Link> },
  { key: 'dashboard', label: <span style={{ color: '#aaa' }}>Dashboard (coming soon)</span>, disabled: true },
];

function App() {
  const location = useLocation();
  const selectedKey = location.pathname.startsWith('/review') ? '/review' : '/videos';

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
        <Menu mode="horizontal" selectedKeys={[selectedKey]} items={menuItems} style={{ minWidth: 360 }} />
      </Header>
      <Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/videos" element={<VideoTable />} />
          <Route path="/videos/:id" element={<VideoCard />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="*" element={<VideoTable />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
