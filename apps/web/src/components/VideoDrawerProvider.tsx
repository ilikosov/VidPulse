import { createDrawerProvider } from '@vidpulse/ui';
import VideoCard from './VideoCard';

interface VideoDrawerApi {
  openVideo: (id: number, onClose?: () => void) => void;
}

const { Provider, useDrawer } = createDrawerProvider<number, VideoDrawerApi>({
  displayName: 'VideoDrawerProvider',
  chrome: { width: 'min(960px, 100vw)' },
  createApi: (open) => ({ openVideo: open }),
  renderBody: (id, _close, onClose) => <VideoCard videoId={id} onChanged={onClose} />,
});

export const VideoDrawerProvider = Provider;
export const useVideoDrawer = useDrawer;
