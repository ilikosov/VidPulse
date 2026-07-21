import { createDrawerProvider } from '@vidpulse/ui';
import FilesPage from '../pages/FilesPage';

interface FilesDrawerApi {
  openFiles: () => void;
}

const { Provider, useDrawer } = createDrawerProvider<boolean, FilesDrawerApi>({
  displayName: 'FilesDrawerProvider',
  chrome: { width: 'min(1100px, 100vw)', title: 'Files' },
  createApi: (open) => ({ openFiles: () => open(true) }),
  renderBody: () => <FilesPage />,
});

export const FilesDrawerProvider = Provider;
export const useFilesDrawer = useDrawer;
