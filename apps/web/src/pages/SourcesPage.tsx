import { Tabs } from '@vidpulse/ui';
import { useSearchParams } from 'react-router-dom';
import AddVideoPage from './AddVideoPage';
import ChannelsPage from './ChannelsPage';
import PlaylistsPage from './PlaylistsPage';

const TABS = ['channels', 'playlists', 'add-video'] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

export default function SourcesPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = isValidTab(raw) ? raw : 'channels';

  return (
    <Tabs
      activeKey={tab}
      onChange={(key) => setParams({ tab: key })}
      items={[
        { key: 'channels', label: 'Channels', children: <ChannelsPage /> },
        { key: 'playlists', label: 'Playlists', children: <PlaylistsPage /> },
        { key: 'add-video', label: 'Add Video', children: <AddVideoPage /> },
      ]}
    />
  );
}
