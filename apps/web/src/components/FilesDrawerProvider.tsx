import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Drawer } from 'antd';
import FilesPage from '../pages/FilesPage';

interface FilesDrawerContextValue {
  openFiles: () => void;
}

const FilesDrawerContext = createContext<FilesDrawerContextValue | null>(null);

export function useFilesDrawer(): FilesDrawerContextValue {
  const ctx = useContext(FilesDrawerContext);
  if (!ctx) throw new Error('useFilesDrawer must be used within a FilesDrawerProvider');
  return ctx;
}

export function FilesDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openFiles = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <FilesDrawerContext.Provider value={{ openFiles }}>
      {children}
      <Drawer
        open={open}
        onClose={handleClose}
        width="min(1100px, 100vw)"
        destroyOnClose
        title="Files"
      >
        {open ? <FilesPage /> : null}
      </Drawer>
    </FilesDrawerContext.Provider>
  );
}
