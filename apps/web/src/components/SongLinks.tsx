import { Fragment } from 'react';
import type { Video } from '../api';
import { LibraryLink } from './LibraryLink';

/**
 * Render the full list of songs linked to a video. Songs come from the
 * `video_songs` junction (source of truth) and each links to its dictionary
 * page. Falls back to the legacy denormalized `song_title` for older data.
 *
 * Links use {@link LibraryLink}: inside the Media Library drawer they navigate
 * in-place; elsewhere (e.g. the main video table) they open the drawer.
 */
export function SongLinks({ video }: { video: Video; from?: unknown }) {
  const songs = video.songs ?? [];

  if (songs.length > 0) {
    return (
      <>
        {songs.map((song, index) => (
          <Fragment key={song.id}>
            {index > 0 && ' + '}
            <LibraryLink to={`/dictionary/songs/${song.id}`}>{song.title}</LibraryLink>
          </Fragment>
        ))}
      </>
    );
  }

  if (video.song_title) {
    return video.song_id ? (
      <LibraryLink to={`/dictionary/songs/${video.song_id}`}>{video.song_title}</LibraryLink>
    ) : (
      <>{video.song_title}</>
    );
  }

  return <>-</>;
}
