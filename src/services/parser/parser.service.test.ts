import { beforeEach, describe, expect, it, vi } from 'vitest';

const dictionaryMock = {
  getGroups: vi.fn(),
  getArtists: vi.fn(),
  getSongs: vi.fn(),
  getEvents: vi.fn(),
  getAllAliases: vi.fn(),
  resolveAlias: vi.fn(),
};

vi.mock('../dictionary.service', () => ({
  dictionaryService: dictionaryMock,
}));

import { parseTitle } from './parser.service';

type ParserResult = Awaited<ReturnType<typeof parseTitle>>;

type ParserCase = {
  name: string;
  title: string;
  expected: {
    perf_date?: string;
    group_name?: string;
    artist_name?: string | string[];
    song_title?: string;
    event?: string | string[];
    is_fancam?: boolean;
    camera_type_includes?: string[];
    needsReview?: boolean;
  };
};

const cases: ParserCase[] = [
  {
    name: 'LE SSERAFIM YUNJIN Inkigayo fancam',
    title: "르세라핌 허윤진 직캠 '1-800-hot-n-fun' (LE SSERAFIM YUNJIN FanCam) @Inkigayo 240901",
    expected: {
      perf_date: '240901',
      group_name: 'LE SSERAFIM',
      artist_name: ['YUNJIN', 'HUH YUNJIN'],
      song_title: '1-800-hot-n-fun',
      event: '@INKIGAYO',
      is_fancam: true,
    },
  },
  {
    name: 'ITZY YUNA Yonsei fancam',
    title: "240526 있지 유나 직캠 'DALLA DALLA' (ITZY YUNA FanCam) @연세대",
    expected: {
      perf_date: '240526',
      group_name: 'ITZY',
      artist_name: 'YUNA',
      song_title: 'DALLA DALLA',
      event: ['@연세대', '@YONSEI'],
      is_fancam: true,
    },
  },
  {
    name: 'KISS OF LIFE NATTY FaceCam',
    title:
      "[페이스캠4K] 키스오브라이프 나띠 'Who is she' (KISS OF LIFE NATTY FaceCam) @SBS Inkigayo 260412",
    expected: {
      perf_date: '260412',
      group_name: 'KISS OF LIFE',
      artist_name: 'NATTY',
      song_title: 'Who is she',
      is_fancam: true,
      camera_type_includes: ['FaceCam', '페이스캠'],
    },
  },
  {
    name: 'Interview Cam should not be fancam',
    title:
      '(ENG)[MusicBank Interview Cam] NCT WISH (엔시티 위시 Interview) l @MusicBank KBS 260501',
    expected: {
      perf_date: '260501',
      is_fancam: false,
    },
  },
  {
    name: 'Private video should require review',
    title: 'Private video',
    expected: {
      is_fancam: false,
      needsReview: true,
    },
  },
  {
    name: 'QWER Chodan vertical fancam showcase',
    title:
      '[4K] QWER 쵸단(Chodan) 「CEREMONY」 세로 직캠 | QWER 미니 4집 ‘CEREMONY’ 쇼케이스, 260427',
    expected: {
      perf_date: '260427',
      group_name: 'QWER',
      artist_name: ['쵸단', 'Chodan'],
      song_title: 'CEREMONY',
      is_fancam: true,
    },
  },
];

function expectOneOf(actual: string | undefined, expected: string | string[]) {
  const values = Array.isArray(expected) ? expected : [expected];
  expect(values).toContain(actual);
}

describe('parseTitle target behavior for YouTube/K-pop titles', () => {
  beforeEach(() => {
    dictionaryMock.getGroups.mockResolvedValue([
      { name: 'LE SSERAFIM' },
      { name: 'ITZY' },
      { name: 'KISS OF LIFE' },
      { name: 'QWER' },
      { name: 'NCT WISH' },
    ]);
    dictionaryMock.getArtists.mockResolvedValue([
      { name: 'YUNJIN', group_name: 'LE SSERAFIM' },
      { name: 'HUH YUNJIN', group_name: 'LE SSERAFIM' },
      { name: 'YUNA', group_name: 'ITZY' },
      { name: 'NATTY', group_name: 'KISS OF LIFE' },
      { name: '쵸단', group_name: 'QWER' },
      { name: 'Chodan', group_name: 'QWER' },
    ]);
    dictionaryMock.getSongs.mockResolvedValue([
      { title: '1-800-hot-n-fun' },
      { title: 'DALLA DALLA' },
      { title: 'Who is she' },
      { title: 'CEREMONY' },
    ]);
    dictionaryMock.getEvents.mockResolvedValue([
      { name: 'INKIGAYO' },
      { name: '연세대' },
      { name: 'MusicBank' },
    ]);
    dictionaryMock.getAllAliases.mockResolvedValue([]);
    dictionaryMock.resolveAlias.mockResolvedValue(null);
  });

  it.each(cases)('$name', async ({ title, expected }) => {
    const result: ParserResult = await parseTitle(title);

    if (expected.perf_date !== undefined) {
      expect(result.metadata.perf_date).toBe(expected.perf_date);
    }
    if (expected.group_name !== undefined) {
      expect(result.metadata.group_name).toBe(expected.group_name);
    }
    if (expected.artist_name !== undefined) {
      expectOneOf(result.metadata.artist_name, expected.artist_name);
    }
    if (expected.song_title !== undefined) {
      expect(result.metadata.song_title).toBe(expected.song_title);
    }
    if (expected.event !== undefined) {
      expectOneOf(result.metadata.event, expected.event);
    }
    if (expected.is_fancam !== undefined) {
      expect(result.metadata.is_fancam).toBe(expected.is_fancam);
    }
    if (expected.camera_type_includes !== undefined) {
      expect(
        expected.camera_type_includes.some((fragment) =>
          (result.metadata.camera_type ?? '').toLowerCase().includes(fragment.toLowerCase()),
        ),
      ).toBe(true);
    }
    if (expected.needsReview !== undefined) {
      expect(result.needsReview).toBe(expected.needsReview);
    }
  });
});
