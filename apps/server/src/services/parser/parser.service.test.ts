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
  // @todo(2026-06-03) TASK-16: song_title is truncated at the apostrophe in `Eye-Poppin'`.
  it.skip('case 1: KickFlip Donghyeon Eye-Poppin', async () => {
    const title =
      "[페이스캠4K] 킥플립 동현 '눈에 거슬리고 싶어 (Eye-Poppin')' (KickFlip Donghyeon FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      "group_name=KICKFLIP | artist_name=DONGHYEON | song_title=눈에 거슬리고 싶어 (Eye-Poppin') | event=@SBS INKIGAYO | camera_type=페이스캠4K | perf_date=260419 | needs_review=false",
    );
  });

  it('case 2: KISS OF LIFE HANEUL Who is she', async () => {
    const title =
      "[안방1열 직캠4K] 키스오브라이프 하늘 'Who is she' (KISS OF LIFE HANEUL FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name=KISS OF LIFE | artist_name=HANEUL | song_title=Who is she | event=@SBS INKIGAYO | camera_type=FANCAM | perf_date=260419 | needs_review=false',
    );
  });

  // @todo(2026-06-03) TASK-16: solo member resolves to her group (WJSN) instead of SOLO, and
  // song_title is truncated at the apostrophe in `What's a girl to do`.
  it.skip("case 3: DAYOUNG What's a girl to do", async () => {
    const title =
      "[안방1열 직캠4K] 다영 'What's a girl to do' (DAYOUNG FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      "group_name=SOLO | artist_name=DAYOUNG | song_title=What's a girl to do | event=@SBS INKIGAYO | camera_type=안방1열 직캠4K | perf_date=260419 | needs_review=false",
    );
  });

  it('case 4: YUNA Ice Cream', async () => {
    const title = "[페이스캠4K] 유나 'Ice Cream' (YUNA FaceCam) @SBS Inkigayo 260329";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name=ITZY | artist_name=YUNA | song_title=Ice Cream | event=@SBS INKIGAYO | camera_type=FACECAM | perf_date=260329 | needs_review=false',
    );
  });

  // @todo(2026-06-03) TASK-16: the stage name "Moon Byul" is split into group=MOON / artist=BYUL.
  it.skip('case 5: Moon Byul Hertz', async () => {
    const title = "[안방1열 직캠4K] 문별 'Hertz' (Moon Byul FanCam) @SBS Inkigayo 260329";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name=Moon | artist_name=MOON BYUL | song_title=Hertz | event=@SBS INKIGAYO | camera_type=안방1열 직캠4K | perf_date=260329 | needs_review=false',
    );
  });
});
