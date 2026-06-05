import { describe, expect, it } from 'vitest';
import { dedupeTitlesCaseInsensitive, splitSongTitles } from './songTitles.util';

describe('splitSongTitles', () => {
  it('prefers the pre-split songTitles list when present', () => {
    expect(splitSongTitles('ignored', ['Bubble', ' ASAP '])).toEqual(['Bubble', 'ASAP']);
  });

  it('splits a legacy song_title on plus, trimming and dropping empties', () => {
    expect(splitSongTitles('Bubble +  ASAP + ')).toEqual(['Bubble', 'ASAP']);
  });

  it('returns an empty list when nothing is provided', () => {
    expect(splitSongTitles()).toEqual([]);
    expect(splitSongTitles(undefined, [])).toEqual([]);
  });
});

describe('dedupeTitlesCaseInsensitive', () => {
  it('removes case-insensitive duplicates, keeping last-seen casing', () => {
    expect(dedupeTitlesCaseInsensitive(['Bubble', 'ASAP', 'bubble', 'asap'])).toEqual([
      'bubble',
      'asap',
    ]);
  });
});
