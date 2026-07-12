import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Drawer } from 'antd';
import FileEditorCard from './FileEditorCard';

interface FileEditorDrawerContextValue {
  openFileEditor: (id: number, onClose?: () => void) => void;
}

const FileEditorDrawerContext = createContext<FileEditorDrawerContextValue | null>(null);

export function useFileEditorDrawer(): FileEditorDrawerContextValue {
  const ctx = useContext(FileEditorDrawerContext);
  if (!ctx) throw new Error('useFileEditorDrawer must be used within a FileEditorDrawerProvider');
  return ctx;
}

export function FileEditorDrawerProvider({ children }: { children: ReactNode }) {
  const [fileId, setFileId] = useState<number | null>(null);
  const [onCloseCb, setOnCloseCb] = useState<(() => void) | undefined>(undefined);

  const openFileEditor = useCallback((id: number, onClose?: () => void) => {
    setFileId(id);
    setOnCloseCb(() => onClose);
  }, []);

  const handleClose = useCallback(() => {
    setFileId(null);
    onCloseCb?.();
    setOnCloseCb(undefined);
  }, [onCloseCb]);

  return (
    <FileEditorDrawerContext.Provider value={{ openFileEditor }}>
      {children}
      <Drawer
        open={fileId != null}
        onClose={handleClose}
        width="min(720px, 100vw)"
        destroyOnClose
        title="File"
      >
        {fileId != null ? (
          <FileEditorCard fileId={fileId} onChanged={onCloseCb} onDeleted={handleClose} />
        ) : null}
      </Drawer>
    </FileEditorDrawerContext.Provider>
  );
}
