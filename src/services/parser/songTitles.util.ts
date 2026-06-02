/**
 * Shared helpers for working with the multiple songs a video can contain.
 *
 * A video title may reference several songs joined with a `+` separator, e.g.
 * "GROUP - Bubble + ASAP @MCOUNTDOWN". These helpers are the single source of
 * truth for turning that into a clean list of song titles.
 */

/**
 * Split a video's song metadata into an ordered list of individual song titles.
 *
 * @param songTitle - Legacy single field, possibly containing `+`-joined songs.
 * @param songTitles - Preferred pre-split list; wins when non-empty.
 */
export function splitSongTitles(songTitle?: string, songTitles?: string[]): string[] {
  if (songTitles?.length) {
    return songTitles.map((song) => song.trim()).filter(Boolean);
  }

  if (!songTitle) return [];
  return songTitle
    .split(/\s*\+\s*/)
    .map((song) => song.trim())
    .filter(Boolean);
}

/**
 * Remove case-insensitive duplicate titles, keeping the last-seen casing.
 */
export function dedupeTitlesCaseInsensitive(titles: string[]): string[] {
  return [...new Map(titles.map((title) => [title.toLowerCase(), title])).values()];
}
