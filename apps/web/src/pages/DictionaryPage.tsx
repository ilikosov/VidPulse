import { Tabs } from '@vidpulse/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { key: '/dictionary/groups', label: 'Groups' },
  { key: '/dictionary/artists', label: 'Artists' },
  { key: '/dictionary/songs', label: 'Songs' },
  { key: '/dictionary/events', label: 'Events / Locations' },
  { key: '/dictionary/tools', label: 'Import / Tools' },
];

export default function DictionaryPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey =
    tabs.find((tab) => location.pathname === tab.key || location.pathname.startsWith(`${tab.key}/`))
      ?.key ?? '/dictionary/groups';

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
