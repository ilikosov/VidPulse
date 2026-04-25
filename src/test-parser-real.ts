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
      group_name: 'KickFlip', // из английского названия группы в скобках
      artist_name: 'Donghyeon', // из скобок участника
      song_title: "눈에 거슬리고 싶어 (Eye-Poppin')",
      event: '@SBS INKIGAYO',
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
      event: '@SBS INKIGAYO',
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
      event: '@SBS INKIGAYO',
      camera_type: '안방1열 직캠4K',
      // group_name может отсутствовать (соло)
    },
  },
  {
    title: "[안방1열 직캠4K] 문별 'Hertz' (Moon Byul FanCam) @SBS Inkigayo 260329",
    publishedAt: '2026-03-29T00:00:00Z',
    expected: {
      perf_date: '260329',
      artist_name: 'Moon Byul',
      song_title: 'Hertz',
      event: '@SBS INKIGAYO',
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
      event: '@SBS INKIGAYO',
      camera_type: '페이스캠4K',
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
