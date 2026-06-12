import { describe, expect, it } from 'vitest';
import { buildRenameCommands } from './renameCommand';

const TEMPLATE =
  '{{video.perf_date}} {{video.group_name}} {{video.artist_name}} - {{video.song_title}} {{video.event}}';

describe('buildRenameCommands', () => {
  it('builds an mv command preserving the source extension', () => {
    const result = buildRenameCommands(TEMPLATE, [
      {
        context: {
          perf_date: '260521',
          group_name: 'I.O.I',
          artist_name: 'SEJEONG',
          song_title: 'Whiplash',
          event: '@MCOUNTDOWN',
        },
        files: [{ directory: '/lib', filename: 'abc.mp4', extension: '.mp4' }],
      },
    ]);
    expect(result).toBe('mv "/lib/abc.mp4" "/lib/260521 I.O.I SEJEONG - Whiplash @MCOUNTDOWN.mp4"');
  });

  it('emits one line per video, joined by newlines', () => {
    const result = buildRenameCommands('{{video.song_title}}', [
      {
        context: { song_title: 'A' },
        files: [{ directory: '/x', filename: '1.mkv', extension: '.mkv' }],
      },
      {
        context: { song_title: 'B' },
        files: [{ directory: '/x', filename: '2.mkv', extension: '.mkv' }],
      },
    ]);
    expect(result).toBe('mv "/x/1.mkv" "/x/A.mkv"\nmv "/x/2.mkv" "/x/B.mkv"');
  });

  it('skips videos without a linked file', () => {
    const result = buildRenameCommands('{{video.song_title}}', [
      { context: { song_title: 'A' }, files: [] },
      {
        context: { song_title: 'B' },
        files: [{ directory: '/x', filename: '2.mp4', extension: '.mp4' }],
      },
    ]);
    expect(result).toBe('mv "/x/2.mp4" "/x/B.mp4"');
  });

  it('replaces slashes in the rendered name so it cannot escape the directory', () => {
    const result = buildRenameCommands('{{video.song_title}}', [
      {
        context: { song_title: 'AC/DC' },
        files: [{ directory: '/x', filename: '1.mp4', extension: '.mp4' }],
      },
    ]);
    expect(result).toBe('mv "/x/1.mp4" "/x/AC-DC.mp4"');
  });
});
