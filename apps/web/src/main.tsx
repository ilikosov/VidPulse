import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SettingsProvider } from './settingsContext';
import { VideoDrawerProvider } from './components/VideoDrawerProvider';
import { FilesDrawerProvider } from './components/FilesDrawerProvider';
import { MediaLibraryDrawerProvider } from './components/MediaLibraryDrawerProvider';
import 'antd/dist/reset.css';
import './index.css';

// The drawer providers sit ABOVE BrowserRouter on purpose: the Media Library
// drawer renders its own MemoryRouter, and react-router forbids nesting a
// <Router> inside another. Keeping these providers outside BrowserRouter means
// the drawer's MemoryRouter is a sibling of the app router, not nested in it.
// (FilesDrawerProvider has no router of its own, but lives alongside
// VideoDrawerProvider here since Files can open a nested video drawer.)
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <VideoDrawerProvider>
        <FilesDrawerProvider>
          <MediaLibraryDrawerProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </MediaLibraryDrawerProvider>
        </FilesDrawerProvider>
      </VideoDrawerProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
