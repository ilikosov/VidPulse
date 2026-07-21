import { Tabs } from '@vidpulse/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { key: '/dictionary/overview', label: 'Overview' },
  { key: '/dictionary/groups', label: 'Groups' },
  { key: '/dictionary/artists', label: 'Artists' },
  { key: '/dictionary/songs', label: 'Songs' },
  { key: '/dictionary/events', label: 'Events / Locations' },
  { key: '/dictionary/tools', label: 'Tools' },
];

export default function MediaLibraryPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey =
    tabs.find((tab) => location.pathname === tab.key || location.pathname.startsWith(`${tab.key}/`))
      ?.key ?? '/dictionary/overview';

  return (
    <>
      <Tabs
        activeKey={activeKey}
        onChange={(tabKey) => navigate(tabKey)}
        items={tabs}
        style={{ marginBottom: 16 }}
      />
      <Outlet />
    </>
  );
}
