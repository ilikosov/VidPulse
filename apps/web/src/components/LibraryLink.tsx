import type { ReactNode } from 'react';
import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { InsideLibraryContext, useMediaLibraryDrawer } from './mediaLibraryDrawerContext';

/**
 * A link to a Media Library entity that works from anywhere in the app.
 *
 * - Inside the Media Library drawer (its own MemoryRouter) it renders a real
 *   `<Link>`, so navigation stays internal to the drawer (no browser URL change)
 *   and the `from` state keeps the back button working.
 * - Anywhere else (video tables, channel/playlist pages) it opens the drawer at
 *   the target path instead of navigating the browser.
 */
export function LibraryLink({ to, children }: { to: string; children: ReactNode }) {
  const inside = useContext(InsideLibraryContext);
  const { openLibrary } = useMediaLibraryDrawer();
  const location = useLocation();

  if (inside) {
    const from = `${location.pathname}${location.search}`;
    return (
      <Link to={to} state={{ from }}>
        {children}
      </Link>
    );
  }

  return (
    <a
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.preventDefault();
        openLibrary(to);
      }}
    >
      {children}
    </a>
  );
}
