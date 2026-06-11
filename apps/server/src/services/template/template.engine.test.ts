import { describe, expect, it } from 'vitest';
import { renderTemplate } from './template.engine';

describe('renderTemplate', () => {
  it('substitutes a scalar token', () => {
    const result = renderTemplate('id={{video.youtube_id}}', { video: [{ youtube_id: 'abc' }] });
    expect(result).toBe('id=abc');
  });

  it('renders an empty string for null/undefined/missing values', () => {
    const result = renderTemplate('[{{video.group_name}}][{{video.artist_name}}][{{video.song}}]', {
      video: [{ group_name: null, artist_name: undefined }],
    });
    expect(result).toBe('[][][]');
  });

  it('joins an array param with the default separator', () => {
    const result = renderTemplate('{{video.songs}}', {
      video: [{ songs: ['A', 'B', 'C'] }],
    });
    expect(result).toBe('A, B, C');
  });

  it('joins an array param with a custom separator', () => {
    const result = renderTemplate('{{video.songs| + }}', {
      video: [{ songs: ['A', 'B'] }],
    });
    expect(result).toBe('A + B');
  });

  it('resolves multiple tokens in one template', () => {
    const result = renderTemplate('{{video.group_name}} - {{video.song_title}}', {
      video: [{ group_name: 'aespa', song_title: 'Whiplash' }],
    });
    expect(result).toBe('aespa - Whiplash');
  });

  it('leaves an unknown entity/param empty', () => {
    const result = renderTemplate('{{movie.title}}{{video.unknown}}', {
      video: [{ youtube_id: 'abc' }],
    });
    expect(result).toBe('');
  });

  it('expands an #each loop into a single command across all videos', () => {
    const template = 'mv {{#each video}}"{{video.youtube_url}}" {{/each}}/dest/';
    const result = renderTemplate(template, {
      video: [
        { youtube_url: 'https://yt/1' },
        { youtube_url: 'https://yt/2' },
        { youtube_url: 'https://yt/3' },
      ],
    });
    expect(result).toBe('mv "https://yt/1" "https://yt/2" "https://yt/3" /dest/');
  });

  it('resolves a token outside a loop against the first video', () => {
    const template = '{{video.group_name}}: {{#each video}}{{video.song_title}} {{/each}}';
    const result = renderTemplate(template, {
      video: [
        { group_name: 'aespa', song_title: 'Drama' },
        { group_name: 'aespa', song_title: 'Spicy' },
      ],
    });
    expect(result).toBe('aespa: Drama Spicy ');
  });

  it('renders an empty loop body when the entity has no records', () => {
    const result = renderTemplate('mv {{#each video}}"{{video.youtube_url}}" {{/each}}/dest/', {
      video: [],
    });
    expect(result).toBe('mv /dest/');
  });
});
