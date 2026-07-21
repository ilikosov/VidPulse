import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SettingsProvider } from './settingsContext';
import { ServerConfigProvider } from './serverConfigContext';
import MonitorMount from './components/MonitorMount';
import { VideoDrawerProvider } from './components/VideoDrawerProvider';
import { FilesDrawerProvider } from './components/FilesDrawerProvider';
import { FileEditorDrawerProvider } from './components/FileEditorDrawerProvider';
import { MediaLibraryDrawerProvider } from './components/MediaLibraryDrawerProvider';
import '@vidpulse/ui/reset.css';
import './index.css';

// The drawer providers sit ABOVE BrowserRouter on purpose: the Media Library
// drawer renders its own MemoryRouter, and react-router forbids nesting a
// <Router> inside another. Keeping these providers outside BrowserRouter means
// the drawer's MemoryRouter is a sibling of the app router, not nested in it.
// (FilesDrawerProvider has no router of its own, but lives alongside
// VideoDrawerProvider here since Files can open a nested video drawer.)
//
// FileEditorDrawerProvider must wrap FilesDrawerProvider, not sit inside it:
// FilesDrawerProvider renders <FilesPage/> as a sibling of `{children}` (inside
// its own Drawer), not as a descendant of `{children}` — so a provider nested
// inside FilesDrawerProvider's `{children}` never reaches FilesPage. Wrapping
// it the other way round makes FilesDrawerProvider's entire subtree (Drawer
// included) a descendant of FileEditorDrawerProvider instead.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ServerConfigProvider>
      <SettingsProvider>
        <VideoDrawerProvider>
          <FileEditorDrawerProvider>
            <FilesDrawerProvider>
              <MediaLibraryDrawerProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </MediaLibraryDrawerProvider>
            </FilesDrawerProvider>
          </FileEditorDrawerProvider>
        </VideoDrawerProvider>
      </SettingsProvider>
      {/* Route-independent monitor overlay (sibling of the app router). */}
      <MonitorMount />
    </ServerConfigProvider>
  </React.StrictMode>,
);
