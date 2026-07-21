import { createDrawerProvider } from '@vidpulse/ui';
import FileEditorCard from './FileEditorCard';

interface FileEditorDrawerApi {
  openFileEditor: (id: number, onClose?: () => void) => void;
}

const { Provider, useDrawer } = createDrawerProvider<number, FileEditorDrawerApi>({
  displayName: 'FileEditorDrawerProvider',
  chrome: { width: 'min(720px, 100vw)', title: 'File' },
  createApi: (open) => ({ openFileEditor: open }),
  renderBody: (id, close, onClose) => (
    <FileEditorCard fileId={id} onChanged={onClose} onDeleted={close} />
  ),
});

export const FileEditorDrawerProvider = Provider;
export const useFileEditorDrawer = useDrawer;
