import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Drawer } from 'antd';
import VideoCard from './VideoCard';

interface VideoDrawerContextValue {
  openVideo: (id: number, onClose?: () => void) => void;
}

const VideoDrawerContext = createContext<VideoDrawerContextValue | null>(null);

export function useVideoDrawer(): VideoDrawerContextValue {
  const ctx = useContext(VideoDrawerContext);
  if (!ctx) throw new Error('useVideoDrawer must be used within a VideoDrawerProvider');
  return ctx;
}

export function VideoDrawerProvider({ children }: { children: ReactNode }) {
  const [videoId, setVideoId] = useState<number | null>(null);
  const [onCloseCb, setOnCloseCb] = useState<(() => void) | undefined>(undefined);

  const openVideo = useCallback((id: number, onClose?: () => void) => {
    setVideoId(id);
    setOnCloseCb(() => onClose);
  }, []);

  const handleClose = useCallback(() => {
    setVideoId(null);
    onCloseCb?.();
    setOnCloseCb(undefined);
  }, [onCloseCb]);

  return (
    <VideoDrawerContext.Provider value={{ openVideo }}>
      {children}
      <Drawer open={videoId != null} onClose={handleClose} width="min(960px, 100vw)" destroyOnClose>
        {videoId != null ? <VideoCard videoId={videoId} onChanged={onCloseCb} /> : null}
      </Drawer>
    </VideoDrawerContext.Provider>
  );
}
