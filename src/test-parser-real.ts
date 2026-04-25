import { parseTitle } from './services/parser/parser.service';

interface TestCase {
  title: string;
  publishedAt: string; // ISO-строка на случай fallback
  expected: {
    perf_date: string;
    group_name?: string;
    artist_name?: string;
    song_title?: string;
    event?: string;
    camera_type?: string;
  };
}

const testCases: TestCase[] = [
  {
    title:
      "[페이스캠4K] 킥플립 동현 '눈에 거슬리고 싶어 (Eye-Poppin')' (KickFlip Donghyeon FanCam) @SBS Inkigayo 260419",
    publishedAt: '2026-04-19T00:00:00Z',
    expected: {
      perf_date: '260419',
      group_name: 'KICKFLIP', // из английского названия группы в скобках
      artist_name: 'DONGHYEON', // из скобок участника
      song_title: "눈에 거슬리고 싶어 (Eye-Poppin')",
      event: '@INKIGAYO',
      camera_type: '페이스캠4K', // или FaceCam 4K
    },
  },
  {
    title:
      "[안방1열 직캠4K] 키스오브라이프 하늘 'Who is she' (KISS OF LIFE HANEUL FanCam) @SBS Inkigayo 260419",
    publishedAt: '2026-04-19T00:00:00Z',
    expected: {
      perf_date: '260419',
      group_name: 'KISS OF LIFE',
      artist_name: 'HANEUL',
      song_title: 'Who is she',
      event: '@INKIGAYO',
      camera_type: '안방1열 직캠4K', // вертикальный fancam 4K
    },
  },
  {
    title: "[안방1열 직캠4K] 다영 'What's a girl to do' (DAYOUNG FanCam) @SBS Inkigayo 260419",
    publishedAt: '2026-04-19T00:00:00Z',
    expected: {
      perf_date: '260419',
      artist_name: 'DAYOUNG',
      song_title: "What's a girl to do",
      event: '@INKIGAYO',
      camera_type: '안방1열 직캠4K',
      // group_name может отсутствовать (соло)
    },
  },
  {
    title: "[안방1열 직캠4K] 문별 'Hertz' (Moon Byul FanCam) @SBS Inkigayo 260329",
    publishedAt: '2026-03-29T00:00:00Z',
    expected: {
      perf_date: '260329',
      artist_name: 'MOON BYUL',
      song_title: 'Hertz',
      event: '@INKIGAYO',
      camera_type: '안방1열 직캠4K',
    },
  },
  {
    title: "[페이스캠4K] 유나 'Ice Cream' (YUNA FaceCam) @SBS Inkigayo 260329",
    publishedAt: '2026-03-29T00:00:00Z',
    expected: {
      perf_date: '260329',
      artist_name: 'YUNA',
      song_title: 'Ice Cream',
      event: '@INKIGAYO',
      camera_type: '페이스캠4K',
    },
  },
  {
    title: '[4K] 240418 ITZY (YEJI) WANNABE @MCOUNTDOWN',
    publishedAt: '2024-04-18T00:00:00Z',
    expected: {
      camera_type: '4K',
      perf_date: '240418',
      group_name: 'ITZY',
      artist_name: 'YEJI',
      song_title: 'WANNABE',
      event: '@MCOUNTDOWN',
    },
  },
  {
    title: "[240316] IVE (WONYOUNG) 'LOVE DIVE' @MUSICCORE 4K",
    publishedAt: '2024-03-16T00:00:00Z',
    expected: {
      perf_date: '240316',
      group_name: 'IVE',
      artist_name: 'WONYOUNG',
      song_title: 'LOVE DIVE',
      event: '@MUSICCORE',
      camera_type: '4K',
    },
  },
  {
    title: '[4K] 231015 BTS Dynamite @INKIGAYO 231015',
    publishedAt: '2023-10-15T00:00:00Z',
    expected: {
      perf_date: '231015',
      group_name: 'BTS',
      song_title: 'Dynamite',
      event: '@INKIGAYO',
      camera_type: '4K',
    },
  },
  {
    title: "[FANCAM] 240220 BLACKPINK 'Shut Down' @MUSICCORE",
    publishedAt: '2024-02-20T00:00:00Z',
    expected: {
      camera_type: 'FANCAM',
      perf_date: '240220',
      group_name: 'BLACKPINK',
      song_title: 'Shut Down',
      event: '@MUSICCORE',
    },
  },
  {
    title: "[VERTICAL FANCAM] 240305 AESPA (KARINA) 'Drama' @MCOUNTDOWN",
    publishedAt: '2024-03-05T00:00:00Z',
    expected: {
      camera_type: 'VERTICAL FANCAM',
      perf_date: '240305',
      group_name: 'AESPA',
      artist_name: 'KARINA',
      song_title: 'Drama',
      event: '@MCOUNTDOWN',
    },
  },
  {
    title: "@MCOUNTDOWN [4K] 240101 NEWJEANS (HANNI) 'OMG'",
    publishedAt: '2024-01-01T00:00:00Z',
    expected: {
      event: '@MCOUNTDOWN',
      camera_type: '4K',
      perf_date: '240101',
      group_name: 'NEWJEANS',
      artist_name: 'HANNI',
      song_title: 'OMG',
    },
  },
  {
    title: "240517 엔믹스 (설윤) 'Love Me Like This' @MUSICCORE",
    publishedAt: '2024-05-17T00:00:00Z',
    expected: {
      perf_date: '240517',
      group_name: 'NMIXX',
      artist_name: 'SULLYOON',
      song_title: 'Love Me Like This',
      event: '@MUSICCORE',
    },
  },
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const [index, tc] of testCases.entries()) {
    console.log(`\nTest ${index + 1}: ${tc.title.substring(0, 50)}...`);
    const result = await parseTitle(tc.title);
    const meta = result.metadata;

    const checks: string[] = [];
    for (const [field, expectedValue] of Object.entries(tc.expected)) {
      const actualValue = (meta as any)[field];
      if (actualValue !== expectedValue) {
        checks.push(`  ❌ ${field}: expected "${expectedValue}", got "${actualValue}"`);
      } else {
        checks.push(`  ✅ ${field}: "${actualValue}"`);
      }
    }

    if (checks.some((c) => c.includes('❌'))) {
      console.log('FAIL');
      checks.forEach((c) => console.log(c));
      failed++;
    } else {
      console.log('PASS');
      checks.forEach((c) => console.log(c));
      passed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

runTests().catch(console.error);
