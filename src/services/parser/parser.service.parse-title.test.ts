import { describe, expect, it } from 'vitest';
import { ParserService } from './parser.service';
import { RegexModule } from './regex.module';
import { DictionaryModule } from './dictionary.module';

type ParseCase = {
  title: string;
  expected: Partial<{
    perf_date: string;
    group_name: string;
    artist_name: string;
    song_title: string;
    event: string;
    is_fancam: boolean;
    needsReview: boolean;
    camera_type: string;
    is_own_group_song: boolean;
    is_own_artist_song: boolean;
  }>;
  expectedArtistVariants?: string[];
};

const dictionaryModule = new DictionaryModule();
const parserService = new ParserService([new RegexModule(), dictionaryModule], dictionaryModule);

describe('ParserService.parseTitle table-driven examples', () => {
  const cases: ParseCase[] = [
    {
      title:
        '250829-31 에스파 카리나 GOOD STUFF @ aespa LIVE TOUR -SYNK : aeXIS LINE- in SEOUL (4K FANCAM MULTI CAM)',
      expected: {
        perf_date: '250829',
        group_name: 'AESPA',
        artist_name: 'KARINA',
        song_title: 'GOOD STUFF',
        event: '@AESPA LIVE TOUR -SYNK : AEXIS LINE- IN SEOUL',
        is_fancam: true,
        needsReview: false,
        is_own_group_song: true,
        is_own_artist_song: false,
      },
    },
    {
      title: '250829 에스파 카리나 UP @ aespa LIVE TOUR -SYNK : aeXIS LINE- in SEOUL (4K FANCAM)',
      expected: {
        perf_date: '250829',
        group_name: 'AESPA',
        artist_name: 'KARINA',
        song_title: 'UP',
        is_fancam: true,
        is_own_group_song: false,
        is_own_artist_song: true,
      },
    },
    {
      title: '250829 에스파 카리나 Solo Group Song @ aespa LIVE TOUR (4K FANCAM)',
      expected: {
        group_name: 'AESPA',
        artist_name: 'KARINA',
        song_title: 'Solo Group Song',
        is_fancam: true,
        is_own_group_song: true,
        is_own_artist_song: true,
      },
    },
    {
      title: '250829 에스파 카리나 UNKNOWN SONG @ aespa LIVE TOUR (4K FANCAM)',
      expected: {
        group_name: 'AESPA',
        artist_name: 'KARINA',
        is_fancam: true,
      },
    },
    {
      title: '250829 에스파 GOOD STUFF @ aespa LIVE TOUR (4K FANCAM)',
      expected: {
        group_name: 'AESPA',
        song_title: 'GOOD STUFF',
        is_fancam: true,
        is_own_group_song: true,
      },
    },
    {
      title: "르세라핌 허윤진 직캠 '1-800-hot-n-fun' (LE SSERAFIM YUNJIN FanCam) @Inkigayo 240901",
      expected: {
        perf_date: '240901',
        group_name: 'LE SSERAFIM',
        artist_name: 'YUNJIN',
        song_title: '1-800-hot-n-fun',
        event: '@INKIGAYO',
        is_fancam: true,
        needsReview: false,
        is_own_group_song: true,
      },
    },
    {
      title:
        '(ENG)[MusicBank Interview Cam] NCT WISH (엔시티 위시 Interview) l @MusicBank KBS 260501',
      expected: {
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
    {
      title: "[4K] QWER 쵸단(Chodan) 'CEREMONY' 직캠 @QWER SHOWCASE",
      expected: {
        group_name: 'QWER',
        is_fancam: true,
        needsReview: false,
      },
      expectedArtistVariants: ['쵸단', 'Chodan'],
    },
  ];

  it.each(cases)('should parse: $title', async ({ title, expected, expectedArtistVariants }) => {
    const result = await parserService.parseTitle(title);

    if (expected.perf_date !== undefined)
      expect(result.metadata.perf_date).toBe(expected.perf_date);
    if (expected.group_name !== undefined)
      expect(result.metadata.group_name).toBe(expected.group_name);
    if (expected.artist_name !== undefined)
      expect(result.metadata.artist_name).toBe(expected.artist_name);
    if (expected.song_title !== undefined)
      expect(result.metadata.song_title).toBe(expected.song_title);
    if (expected.event !== undefined) expect(result.metadata.event).toBe(expected.event);
    if (expected.is_fancam !== undefined)
      expect(result.metadata.is_fancam).toBe(expected.is_fancam);
    if (expected.needsReview !== undefined) expect(result.needsReview).toBe(expected.needsReview);
    if (expected.is_own_group_song !== undefined)
      expect(result.metadata.is_own_group_song).toBe(expected.is_own_group_song);
    if (expected.is_own_artist_song !== undefined)
      expect(result.metadata.is_own_artist_song).toBe(expected.is_own_artist_song);

    if (expectedArtistVariants) {
      expect(expectedArtistVariants).toContain(result.metadata.artist_name);
    }

    if (title.includes('UNKNOWN SONG')) {
      expect(result.metadata.is_own_group_song).toBeUndefined();
      expect(result.metadata.is_own_artist_song).toBeUndefined();
    }

    if (title === '250829 에스파 GOOD STUFF @ aespa LIVE TOUR (4K FANCAM)') {
      expect(result.metadata.is_own_artist_song).toBeUndefined();
    }
  });
});

describe('parseTitle real-world examples', () => {
  const examples: ParseCase[] = [
    {
      title: "[안방1열 직캠4K] 넥스지 휴이 'Mmchk' (NEXZ HYUI FanCam) @SBS Inkigayo 260503",
      expected: { is_fancam: true, perf_date: '260503', song_title: 'Mmchk' },
    },
    {
      title:
        "[페이스캠4K] 코르티스 성현 'REDRED' (CORTIS SEONGHYEON FaceCam) @SBS Inkigayo ON THE GO 260426",
      expected: { is_fancam: true, perf_date: '260426', song_title: 'REDRED' },
    },
    {
      title: "260425 IVE 아이브 직캠 'BANG BANG' | SHOW WHAT I AM - MANILA",
      expected: { is_fancam: true, perf_date: '260425', song_title: 'BANG BANG' },
    },
    {
      title:
        "[4K] QWER 쵸단(chodan) '고민중독(T.B.H)' 세로 직캠 @QWER The (1st) Mini Album 'MANITO' Showcase, 240401",
      expected: { is_fancam: true, perf_date: '240401', group_name: 'QWER' },
    },
    {
      title:
        '[4K] KEYVITUP(키빗업) 「KEYVITUP」 가로 직캠 | ENA K POP UP CHART SHOW(케이팝업 차트쇼), 260428',
      expected: { is_fancam: true, perf_date: '260428', song_title: 'KEYVITUP' },
    },
    {
      title:
        '[#음중직캠] KickFlip DONGHYEON (킥플립 동현) – 눈에 거슬리고 싶어 FanCam | 쇼! 음악중심 | MBC260411',
      expected: { is_fancam: true, perf_date: '260411' },
    },
    {
      title: 'LEE CHAEYEON (이채연) - No Tears On The Dancefloor | Show! MusicCore | MBC260502방송',
      expected: { is_fancam: false, perf_date: '260502' },
    },
    {
      title: '이재훈 - 작은 기다림 [더 시즌즈-성시경의 고막남친] | KBS 260403 방송',
      expected: { is_fancam: false, perf_date: '260403' },
    },
    {
      title: '[하이라이트] moyo(모요) - 누구야 [더 시즌즈-성시경의 고막남친] | KBS 방송',
      expected: { is_fancam: false },
    },
    {
      title:
        '(ENG)[MusicBank Interview Cam] NCT WISH (엔시티 위시 Interview) l @MusicBank KBS 260501',
      expected: { is_fancam: false, perf_date: '260501' },
    },
    {
      title: "[4K] 260321 아이브 이서 직캠 'HEYA' (IVE LEESEO FanCam) @DIVE into IVE",
      expected: { is_fancam: true, perf_date: '260321', song_title: 'HEYA' },
    },
    {
      title: "앳하트 나현 'Shut Up' 직캠 260425@광주왕실도자기페스티벌",
      expected: { is_fancam: true, perf_date: '260425', song_title: 'Shut Up' },
    },
    {
      title: "있지 유나 '캐치 캐치' 챌린지 미니팬미팅 직캠 260404@상암",
      expected: { is_fancam: true, perf_date: '260404', group_name: 'ITZY' },
    },
    {
      title: "에스투잇 승비 'How Sweet' 직캠 260505@서산 어린이축제",
      expected: { is_fancam: true, perf_date: '260505', song_title: 'How Sweet' },
    },
    {
      title:
        '[4K] EVERGLOW(에버글로우) 이유(E:U) 「CODE」 세로 직캠 | ENA K POP UP CHART SHOW(케이팝업 차트쇼)',
      expected: { is_fancam: true, song_title: 'CODE' },
    },
    {
      title:
        "[안방1열 직캠4K] 캣츠아이 메간 'PINKY UP' (KATSEYE Megan FanCam) @SBS Inkigayo 260503",
      expected: { is_fancam: true, perf_date: '260503', song_title: 'PINKY UP' },
    },
    {
      title:
        "[안방1열 직캠4K] 산토스 브라보스 케네스 'VELOCIDADE' (SANTOS BRAVOS Kenneth FanCam) @SBS Inkigayo 260419",
      expected: { is_fancam: true, perf_date: '260419', song_title: 'VELOCIDADE' },
    },
    {
      title: "[UNFILTERED CAM] KATSEYE Lara(라라) 'PINKY UP' 4K | STUDIO CHOOM ORIGINAL",
      expected: {
        is_fancam: true,
        group_name: 'KATSEYE',
        artist_name: 'Lara',
        song_title: 'PINKY UP',
        event: '@STUDIO CHOOM ORIGINAL',
      } as any,
    },
    {
      title:
        "260430 리센느 미나미 직캠 (RESCENE MINAMI FanCam) 'Runaway' @ 경일대 축제 #갸루 #kpop #リセンヌ #ミナミ",
      expected: {
        perf_date: '260430',
        group_name: 'RESCENE',
        artist_name: 'MINAMI',
        song_title: 'Runaway',
        event: '@KYUNGIL UNIVERSITY FESTIVAL',
        is_fancam: true,
        is_own_group_song: false,
      } as any,
    },
    {
      title: '250727 에스파 카리나 Dark Arts @ PUBG NATIONS CUP 2025 - FINAL STAGE (4K FANCAM)',
      expected: {
        perf_date: '250727',
        group_name: 'AESPA',
        artist_name: 'KARINA',
        song_title: 'Dark Arts',
        event: '@PUBG NATIONS CUP 2025 - FINAL STAGE',
        is_fancam: true,
        is_own_group_song: false,
      } as any,
    },
    {
      title:
        '250727 에스파 카리나 Unknown Song Title @ PUBG NATIONS CUP 2025 - FINAL STAGE (4K FANCAM)',
      expected: {
        perf_date: '250727',
        group_name: 'AESPA',
        artist_name: 'KARINA',
        is_fancam: true,
      } as any,
    },
    { title: '[#shorts] 아이브 리즈 직캠', expected: { is_fancam: false } },
    { title: 'Private video', expected: { is_fancam: false, needsReview: true } },
    {
      title: 'BTS WORLD TOUR "ARIRANG" in GOYANG (ending ment) /26.04.09/',
      expected: { is_fancam: false, song_title: 'ARIRANG' },
    },
    {
      title:
        '[4K] LE SSERAFIM KIMCHAEWON 르세라핌 김채원 - "CELEBRATION" 직캠 FANCAM | 260426 SBS 인기가요 ON THE GO',
      expected: { is_fancam: true, perf_date: '260426', song_title: 'CELEBRATION' },
    },
    {
      title: "르세라핌 허윤진 직캠 'HOT' @Inkigayo 260101",
      expected: {
        is_fancam: true,
        group_name: 'LE SSERAFIM',
        artist_name: 'YUNJIN',
        camera_type: 'FANCAM',
      } as any,
    },
    {
      title: "있지 유나 직캠 'DALLA DALLA' 260101",
      expected: {
        is_fancam: true,
        group_name: 'ITZY',
        artist_name: 'YUNA',
        camera_type: 'FANCAM',
      } as any,
    },
    {
      title: "프로미스나인 백지헌 직캠 'DM' 260101",
      expected: { is_fancam: true, group_name: 'fromis_9', camera_type: 'FANCAM' } as any,
    },
    {
      title: "240526 있지 유나 직캠 'DALLA DALLA' (ITZY YUNA FanCam) @연세대",
      expected: { is_fancam: true, event: '@YONSEI UNIVERSITY', camera_type: 'FANCAM' } as any,
    },
    {
      title:
        "[MPD직캠] TXT 휴닝카이 직캠 4K '하루에 하루만 더 (Stick With You)' (TXT HUENING KAI FanCam) | @MCOUNTDOWN_2026.4.16",
      expected: { is_fancam: true, song_title: '하루에 하루만 더 (Stick With You)' },
    },
  ];

  it.each(examples)('parses real-world title: $title', async ({ title, expected }) => {
    const result = await parserService.parseTitle(title);

    expect(result.metadata.is_fancam).toBe(expected.is_fancam);

    if (expected.perf_date !== undefined) {
      expect(result.metadata.perf_date).toBe(expected.perf_date);
    }
    if (expected.song_title !== undefined) {
      expect(result.metadata.song_title).toBe(expected.song_title);
    }
    if (expected.group_name !== undefined) {
      expect(result.metadata.group_name).toBe(expected.group_name);
    }
    if (expected.artist_name !== undefined) {
      expect(result.metadata.artist_name).toBe(expected.artist_name);
    }
    if ((expected as any).camera_type !== undefined) {
      expect(result.metadata.camera_type).toBe((expected as any).camera_type);
    }
    if (
      title === '250727 에스파 카리나 Dark Arts @ PUBG NATIONS CUP 2025 - FINAL STAGE (4K FANCAM)'
    ) {
      expect(result.metadata.camera_type).toContain('FANCAM');
      expect(result.metadata.fancam_confidence).toBeGreaterThanOrEqual(0.95);
      expect(result.needsReview).toBe(false);
    }
    if (title === "[UNFILTERED CAM] KATSEYE Lara(라라) 'PINKY UP' 4K | STUDIO CHOOM ORIGINAL") {
      expect(result.metadata.camera_type).toContain('UNFILTERED CAM');
      expect(result.metadata.camera_type).toContain('4K');
      expect(result.metadata.fancam_confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.needsReview).toBe(false);
    }
    if (
      title ===
      "260430 리센느 미나미 직캠 (RESCENE MINAMI FanCam) 'Runaway' @ 경일대 축제 #갸루 #kpop #リセンヌ #ミナミ"
    ) {
      expect(result.metadata.camera_type).toContain('FANCAM');
      expect(result.needsReview).toBe(false);
    }
    if (expected.needsReview !== undefined) {
      expect(result.needsReview).toBe(expected.needsReview);
    }
  });
});
