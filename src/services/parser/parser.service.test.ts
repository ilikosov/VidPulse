import { describe, expect, it } from 'vitest';
import { parseTitle } from './parser.service';

const cases = [
  "[페이스캠4K] 킥플립 동현 '눈에 거슬리고 싶어 (Eye-Poppin')' (KickFlip Donghyeon FanCam) @SBS Inkigayo 260419",
  "[안방1열 직캠4K] 키스오브라이프 하늘 'Who is she' (KISS OF LIFE HANEUL FanCam) @SBS Inkigayo 260419",
  "[안방1열 직캠4K] 다영 'What's a girl to do' (DAYOUNG FanCam) @SBS Inkigayo 260419",
  "[페이스캠4K] 유나 'Ice Cream' (YUNA FaceCam) @SBS Inkigayo 260329",
  "[안방1열 직캠4K] 문별 'Hertz' (Moon Byul FanCam) @SBS Inkigayo 260329",
];

describe('parseTitle', () => {
  it.each(cases)('parses SBS Inkigayo fancam case: %s', async (title) => {
    const { metadata, needsReview } = await parseTitle(title);

    expect(metadata.song_title).toBeTypeOf('string');
    expect(metadata.song_title).toBeTruthy();

    expect(metadata.artist_name).toBeTypeOf('string');
    expect(metadata.artist_name).toBeTruthy();

    expect(metadata.event).toBeTypeOf('string');
    expect(metadata.event).toContain('@SBS INKIGAYO');

    expect(metadata.camera_type).toBe('4K');

    expect(needsReview).toBe(true);
  });
});
