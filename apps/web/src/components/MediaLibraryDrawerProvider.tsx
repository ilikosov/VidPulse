import { useCallback, useState, type ReactNode } from 'react';
import { Drawer } from '@vidpulse/ui';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import MediaLibraryPage from '../pages/MediaLibraryPage';
import MediaLibraryOverviewPage from '../pages/MediaLibraryOverviewPage';
import GroupsListPage from '../pages/GroupsListPage';
import GroupPage from '../pages/GroupPage';
import ArtistsListPage from '../pages/ArtistsListPage';
import ArtistPage from '../pages/ArtistPage';
import SongsListPage from '../pages/SongsListPage';
import SongPage from '../pages/SongPage';
import EventDictionaryPage from '../pages/EventDictionaryPage';
import EventPage from '../pages/EventPage';
import DictionaryToolsPage from '../pages/DictionaryToolsPage';
import { InsideLibraryContext, MediaLibraryDrawerContext } from './mediaLibraryDrawerContext';

const DEFAULT_PATH = '/dictionary/overview';

/**
 * The Media Library section, rendered inside the drawer in its own MemoryRouter.
 * The route tree mirrors the former browser routes (`/dictionary/*`) so every
 * page keeps working unchanged, while navigation stays in memory — the browser
 * URL never changes.
 */
function MediaLibraryRoutes() {
  return (
    <Routes>
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
      <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
    </Routes>
  );
}

export function MediaLibraryDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialPath, setInitialPath] = useState(DEFAULT_PATH);

  const openLibrary = useCallback((path?: string) => {
    setInitialPath(path ?? DEFAULT_PATH);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <MediaLibraryDrawerContext.Provider value={{ openLibrary }}>
      {children}
      <Drawer
        open={open}
        onClose={handleClose}
        width="min(1280px, 100vw)"
        destroyOnClose
        title="Media Library"
      >
        <InsideLibraryContext.Provider value={true}>
          <MemoryRouter initialEntries={[initialPath]}>
            <MediaLibraryRoutes />
          </MemoryRouter>
        </InsideLibraryContext.Provider>
      </Drawer>
    </MediaLibraryDrawerContext.Provider>
  );
}
