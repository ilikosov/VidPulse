import { describe, expect, it } from 'vitest';
import { parseTitle } from './parseTitle';

// Show-channel titles segment the credit / song list / show name with pipes instead of the
// usual quote + "@event" layout, e.g.
//   [우쥬레코드] aespa 카리나 with 윤하 | 그 사람, 꽃같네, 수영해, Can't Help Myself | WOULD YOU RECORD (ENG/JPN)
// The generic extractors grabbed the song list as the event and let a song word ("수영해")
// fuzzy-resolve the artist to the wrong member. aespa/Karina ship in the seed dictionary.

describe('parseTitle - pipe-segmented show-channel titles', () => {
  it('splits credit / song-list / show across three pipe segments', async () => {
    const title =
      "[우쥬레코드] aespa 카리나 with 윤하 | 그 사람, 꽃같네, 수영해, Can't Help Myself | WOULD YOU RECORD (ENG/JPN)";
    const { metadata } = await parseTitle(title);

    expect(metadata.group_name).toBe('aespa');
    expect(metadata.artist_name).toBe('Karina');
    expect(metadata.song_titles).toEqual(['그 사람', '꽃같네', '수영해', "Can't Help Myself"]);
    expect(metadata.song_title).toBe("Can't Help Myself");
    expect(metadata.event).toBe('@WOULD YOU RECORD');
  });

  it('leaves a two-segment "song | @event" title to the generic path', async () => {
    const title = "aespa - 'Whiplash' | @MCOUNTDOWN 260221";
    const { metadata } = await parseTitle(title);

    // Single pipe -> segmented parse is skipped; the song stays the song and the event is
    // the real @event, not the song list.
    expect(metadata.song_title).toBe('Whiplash');
    expect(metadata.event).toContain('COUNTDOWN');
    expect(metadata.event).not.toContain('Whiplash');
  });
});
