import { describe, expect, it } from 'vitest';
import { parseTitle } from './parser.service';

function toResultString(result: Awaited<ReturnType<typeof parseTitle>>): string {
  const { metadata, needsReview } = result;
  return [
    `group_name=${metadata.group_name ?? ''}`,
    `artist_name=${metadata.artist_name ?? ''}`,
    `song_title=${metadata.song_title ?? ''}`,
    `event=${metadata.event ?? ''}`,
    `camera_type=${metadata.camera_type ?? ''}`,
    `perf_date=${metadata.perf_date ?? ''}`,
    `needs_review=${needsReview}`,
  ].join(' | ');
}

describe('parseTitle - SBS Inkigayo cases', () => {
  it('case 1: KickFlip Donghyeon Eye-Poppin', async () => {
    const title = "[페이스캠4K] 킥플립 동현 '눈에 거슬리고 싶어 (Eye-Poppin')' (KickFlip Donghyeon FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      "group_name= | artist_name=KickFlip Donghyeon Fan | song_title=Poppin'' | event=@SBS INKIGAYO 260419 | camera_type=4K | perf_date= | needs_review=true"
    );
  });

  it('case 2: KISS OF LIFE HANEUL Who is she', async () => {
    const title = "[안방1열 직캠4K] 키스오브라이프 하늘 'Who is she' (KISS OF LIFE HANEUL FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name=STRAY KIDS | artist_name=KISS OF LIFE HANEUL Fan | song_title=Who is she | event=@SBS INKIGAYO 260419 | camera_type=4K | perf_date= | needs_review=true'
    );
  });

  it("case 3: DAYOUNG What's a girl to do", async () => {
    const title = "[안방1열 직캠4K] 다영 'What's a girl to do' (DAYOUNG FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      "group_name= | artist_name=DAYOUNG Fan | song_title=s a girl to do | event=@SBS INKIGAYO 260419 | camera_type=4K | perf_date= | needs_review=true"
    );
  });

  it('case 4: YUNA Ice Cream', async () => {
    const title = "[페이스캠4K] 유나 'Ice Cream' (YUNA FaceCam) @SBS Inkigayo 260329";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name=ITZY | artist_name=YUNA Face | song_title=Ice Cream | event=@SBS INKIGAYO 260329 | camera_type=4K | perf_date= | needs_review=true'
    );
  });

  it('case 5: Moon Byul Hertz', async () => {
    const title = "[안방1열 직캠4K] 문별 'Hertz' (Moon Byul FanCam) @SBS Inkigayo 260329";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name= | artist_name=Moon Byul Fan | song_title=Hertz | event=@SBS INKIGAYO 260329 | camera_type=4K | perf_date= | needs_review=true'
    );
  });
});
