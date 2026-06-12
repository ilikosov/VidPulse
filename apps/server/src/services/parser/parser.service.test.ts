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
    const title =
      "[페이스캠4K] 킥플립 동현 '눈에 거슬리고 싶어 (Eye-Poppin')' (KickFlip Donghyeon FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    // The apostrophe inside "(Eye-Poppin')" must no longer truncate the song title.
    expect(toResultString(result)).toBe(
      "group_name=KICKFLIP | artist_name=DONGHYEON | song_title=눈에 거슬리고 싶어 (Eye-Poppin') | event=@SBS INKIGAYO | camera_type=FANCAM | perf_date=260419 | needs_review=false",
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

  it("case 3: DAYOUNG What's a girl to do", async () => {
    const title =
      "[안방1열 직캠4K] 다영 'What's a girl to do' (DAYOUNG FanCam) @SBS Inkigayo 260419";
    const result = await parseTitle(title);

    // A lone "(DAYOUNG FanCam)" credit is a solo stage, so the group is SOLO rather
    // than the member's home group, and the apostrophe in "What's" is preserved.
    expect(toResultString(result)).toBe(
      "group_name=SOLO | artist_name=DAYOUNG | song_title=What's a girl to do | event=@SBS INKIGAYO | camera_type=FANCAM | perf_date=260419 | needs_review=false",
    );
  });

  it('case 4: YUNA Ice Cream', async () => {
    const title = "[페이스캠4K] 유나 'Ice Cream' (YUNA FaceCam) @SBS Inkigayo 260329";
    const result = await parseTitle(title);

    expect(toResultString(result)).toBe(
      'group_name=ITZY | artist_name=YUNA | song_title=Ice Cream | event=@SBS INKIGAYO | camera_type=FACECAM | perf_date=260329 | needs_review=false',
    );
  });

  it('case 5: Moon Byul Hertz', async () => {
    const title = "[안방1열 직캠4K] 문별 'Hertz' (Moon Byul FanCam) @SBS Inkigayo 260329";
    const result = await parseTitle(title);

    // The romanized stage name "Moon Byul" must stay a single artist (resolved to the
    // canonical MOONBYUL) instead of being split into group=MOON / artist=BYUL.
    expect(toResultString(result)).toBe(
      'group_name=SOLO | artist_name=MOONBYUL | song_title=Hertz | event=@SBS INKIGAYO | camera_type=FANCAM | perf_date=260329 | needs_review=false',
    );
  });

  it('case 6: IVE group fancam — Korean group alias is not a member', async () => {
    const title = "260425 IVE 아이브 직캠 'BANG BANG' | SHOW WHAT I AM - MANILA";
    const result = await parseTitle(title);

    // 아이브 is IVE's own Korean alias (a group-only credit), so artist_name stays empty.
    // It must not substring-match the artist alias 이브 (Yves, a LOONA member).
    expect(toResultString(result)).toBe(
      'group_name=IVE | artist_name= | song_title=BANG BANG | event=@SHOW WHAT I AM - MANILA | camera_type=FANCAM | perf_date=260425 | needs_review=false',
    );
  });
});
