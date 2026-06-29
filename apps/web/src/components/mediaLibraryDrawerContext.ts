import { createContext, useContext } from 'react';

export interface MediaLibraryDrawerContextValue {
  /** Open the Media Library drawer, optionally at a specific entity path. */
  openLibrary: (path?: string) => void;
}

export const MediaLibraryDrawerContext = createContext<MediaLibraryDrawerContextValue | null>(null);

export function useMediaLibraryDrawer(): MediaLibraryDrawerContextValue {
  const ctx = useContext(MediaLibraryDrawerContext);
  if (!ctx) {
    throw new Error('useMediaLibraryDrawer must be used within a MediaLibraryDrawerProvider');
  }
  return ctx;
}

/**
 * True when the subtree is rendered inside the Media Library drawer (its own
 * MemoryRouter). Library cross-links use this to decide between in-drawer
 * navigation and opening the drawer from elsewhere in the app.
 */
export const InsideLibraryContext = createContext(false);

export function useInsideLibrary(): boolean {
  return useContext(InsideLibraryContext);
}
