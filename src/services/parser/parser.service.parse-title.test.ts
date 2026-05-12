import { describe, expect, it } from 'vitest';
import { ParserService } from './parser.service';
import { RegexModule } from './regex.module';

describe('ParserService.parseTitle table-driven examples', () => {
  const parserService = new ParserService([new RegexModule()]);

  const cases = [
    {
      title: "르세라핌 허윤진 직캠 '1-800-hot-n-fun' (LE SSERAFIM YUNJIN FanCam) @Inkigayo 240901",
      expected: {
        perf_date: '240901',
        group_name: 'LE SSERAFIM',
        artist_name: 'YUNJIN',
        song_title: '1-800-hot-n-fun',
        event: '@INKIGAYO',
        is_fancam: true,
      },
    },
    {
      title: "240526 있지 유나 직캠 'DALLA DALLA' (ITZY YUNA FanCam) @연세대",
      expected: {
        perf_date: '240526',
        group_name: 'ITZY',
        artist_name: 'YUNA',
        song_title: 'DALLA DALLA',
        event: '@연세대',
        is_fancam: true,
      },
    },
    {
      title:
        '[4K] QWER 쵸단(Chodan) 「CEREMONY」 세로 직캠 | QWER 미니 4집 ‘CEREMONY’ 쇼케이스, 260427',
      expected: {
        perf_date: '260427',
        group_name: 'QWER',
        song_title: 'CEREMONY',
        is_fancam: true,
      },
      expectedArtistVariants: ['쵸단', 'Chodan'],
    },
    {
      title:
        "[페이스캠4K] 키스오브라이프 나띠 'Who is she' (KISS OF LIFE NATTY FaceCam) @SBS Inkigayo 260412",
      expected: {
        perf_date: '260412',
        group_name: 'KISS OF LIFE',
        artist_name: 'NATTY',
        song_title: 'Who is she',
        is_fancam: true,
      },
    },
    {
      title:
        '(ENG)[MusicBank Interview Cam] NCT WISH (엔시티 위시 Interview) l @MusicBank KBS 260501',
      expected: {
        perf_date: '260501',
        is_fancam: false,
      },
    },
    {
      title: 'Private video',
      expected: {
        is_fancam: false,
        needsReview: true,
      },
    },
  ] as const;

  it.each(cases)('should parse: $title', async ({ title, expected, expectedArtistVariants }) => {
    const result = await parserService.parseTitle(title);

    if (expected.perf_date !== undefined) {
      expect(result.metadata.perf_date).toBe(expected.perf_date);
    }
    if (expected.group_name !== undefined) {
      expect(result.metadata.group_name).toBe(expected.group_name);
    }
    if (expected.artist_name !== undefined) {
      expect(result.metadata.artist_name).toBe(expected.artist_name);
    }
    if (expected.song_title !== undefined) {
      expect(result.metadata.song_title).toBe(expected.song_title);
    }
    if (expected.event !== undefined) {
      expect(result.metadata.event).toBe(expected.event);
    }

    if (expectedArtistVariants) {
      expect(expectedArtistVariants).toContain(result.metadata.artist_name);
    }

    const hasCam = /\b(fancam|face\s*cam|cam|직캠)\b/i.test(title);
    expect(hasCam).toBe(expected.is_fancam);

    if (expected.needsReview !== undefined) {
      expect(result.needsReview).toBe(expected.needsReview);
    }
  });
});
