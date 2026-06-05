import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../api';

/**
 * Render the full list of songs linked to a video. Songs come from the
 * `video_songs` junction (source of truth) and each links to its dictionary
 * page. Falls back to the legacy denormalized `song_title` for older data.
 */
export function SongLinks({ video, from }: { video: Video; from?: unknown }) {
  const songs = video.songs ?? [];

  if (songs.length > 0) {
    return (
      <>
        {songs.map((song, index) => (
          <Fragment key={song.id}>
            {index > 0 && ' + '}
            <Link to={`/dictionary/songs/${song.id}`} state={{ from }}>
              {song.title}
            </Link>
          </Fragment>
        ))}
      </>
    );
  }

  if (video.song_title) {
    return video.song_id ? (
      <Link to={`/dictionary/songs/${video.song_id}`} state={{ from }}>
        {video.song_title}
      </Link>
    ) : (
      <>{video.song_title}</>
    );
  }

  return <>-</>;
}
