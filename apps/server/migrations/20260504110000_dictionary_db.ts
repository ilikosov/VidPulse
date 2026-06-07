import type { Knex } from 'knex';

const GROUPS = [
  { name: 'BLACKPINK', type: 'female', members: ['JISOO', 'JENNIE', 'ROSÉ', 'LISA'] },
  {
    name: 'TWICE',
    type: 'female',
    members: [
      'NAYEON',
      'JEONGYEON',
      'MOMO',
      'SANA',
      'JIHYO',
      'MINA',
      'DAHYUN',
      'CHAEYOUNG',
      'TZUYU',
    ],
  },
  { name: 'Red Velvet', type: 'female', members: ['IRENE', 'SEULGI', 'WENDY', 'JOY', 'YERI'] },
  { name: 'aespa', type: 'female', members: ['KARINA', 'GISELLE', 'WINTER', 'NINGNING'] },
  {
    name: 'IVE',
    type: 'female',
    members: ['ANYUJIN', 'GAEUL', 'REI', 'JANGWONYOUNG', 'LIZ', 'LEESEO'],
  },
  {
    name: 'LE SSERAFIM',
    type: 'female',
    members: ['KIM CHAEWON', 'SAKURA', 'HUH YUNJIN', 'KAZUHA', 'HONG EUNCHAE'],
  },
  { name: 'NewJeans', type: 'female', members: ['MINJI', 'HANNI', 'DANIELLE', 'HAERIN', 'HYEIN'] },
  { name: 'ITZY', type: 'female', members: ['YEJI', 'LIA', 'RYUJIN', 'CHAERYEONG', 'YUNA'] },
  { name: '(G)I-DLE', type: 'female', members: ['MIYEON', 'MINNIE', 'SOYEON', 'YUQI', 'SHUHUA'] },
  { name: 'STAYC', type: 'female', members: ['SUMIN', 'SIEUN', 'ISA', 'SEEUN', 'YOON', 'J'] },
  {
    name: 'fromis_9',
    type: 'female',
    members: ['SAEROM', 'HAYOUNG', 'JIWON', 'NAGYUNG', 'JIHEON'],
  },
  {
    name: 'NMIXX',
    type: 'female',
    members: ['LILY', 'HAEWON', 'SULLYOON', 'BAE', 'JIWOO', 'KYUJIN'],
  },
  {
    name: 'Kep1er',
    type: 'female',
    members: [
      'YUJIN',
      'XIAOTING',
      'CHAEHYUN',
      'DAYEON',
      'HIKARU',
      'HUENING BAHIYYIH',
      'YOUNGEUN',
      'YESEO',
    ],
  },
  {
    name: "Girls' Generation",
    type: 'female',
    members: ['TAEYEON', 'SUNNY', 'TIFFANY', 'HYOYEON', 'YURI', 'SOOYOUNG', 'YOONA', 'SEOHYUN'],
  },
  { name: 'MAMAMOO', type: 'female', members: ['SOLAR', 'MOONBYUL', 'WHEEIN', 'HWASA'] },
  {
    name: 'OH MY GIRL',
    type: 'female',
    members: ['HYOJUNG', 'MIMI', 'YOOA', 'SEUNGHEE', 'YUBIN', 'ARIN'],
  },
  {
    name: 'WJSN',
    type: 'female',
    members: [
      'SEOLA',
      'XUANYI',
      'BONA',
      'EXY',
      'SOOBIN',
      'LUDA',
      'DAWON',
      'EUNSEO',
      'YEORUM',
      'DAYOUNG',
      'YEONJUNG',
    ],
  },
  {
    name: 'Dreamcatcher',
    type: 'female',
    members: ['JIU', 'SUA', 'SIYEON', 'HANDONG', 'YOOHYEON', 'DAMI', 'GAHYEON'],
  },
  { name: 'KISS OF LIFE', type: 'female', members: ['JULIE', 'NATTY', 'BELLE', 'HANEUL'] },
  {
    name: 'BABYMONSTER',
    type: 'female',
    members: ['RUKA', 'PHARITA', 'ASA', 'AHYEON', 'RAMI', 'RORA', 'CHIQUITA'],
  },
  { name: 'ILLIT', type: 'female', members: ['YUNAH', 'MINJU', 'MOKA', 'WONHEE', 'IROHA'] },
  {
    name: 'FIFTY FIFTY',
    type: 'female',
    members: ['KEENA', 'CHANELLE MOON', 'YEWON', 'HANA', 'ATHENA'],
  },
  { name: 'tripleS', type: 'female', members: ['SEOYEON', 'Nakyoung', 'Yubin', 'Kaede'] },
  {
    name: 'UNIS',
    type: 'female',
    members: [
      'JIN HYEONJU',
      'NANA',
      'GEHLEE',
      'KOTOKO',
      'BANG YUNHA',
      'ELISIA',
      'OH YOONA',
      'LIM SEOWON',
    ],
  },
  { name: 'BTS', type: 'male', members: ['RM', 'JIN', 'SUGA', 'J-HOPE', 'JIMIN', 'V', 'JUNGKOOK'] },
  {
    name: 'SEVENTEEN',
    type: 'male',
    members: [
      'S.COUPS',
      'JEONGHAN',
      'JOSHUA',
      'JUN',
      'HOSHI',
      'WONWOO',
      'WOOZI',
      'DK',
      'MINGYU',
      'THE8',
      'SEUNGKWAN',
      'VERNON',
      'DINO',
    ],
  },
  {
    name: 'EXO',
    type: 'male',
    members: ['SUHO', 'XIUMIN', 'BAEKHYUN', 'CHEN', 'CHANYEOL', 'D.O.', 'KAI', 'SEHUN'],
  },
  {
    name: 'NCT 127',
    type: 'male',
    members: [
      'TAEIL',
      'JOHNNY',
      'TAEYONG',
      'YUTA',
      'DOYOUNG',
      'JAEHYUN',
      'JUNGWOO',
      'MARK',
      'HAECHAN',
    ],
  },
  {
    name: 'NCT DREAM',
    type: 'male',
    members: ['MARK', 'RENJUN', 'JENO', 'HAECHAN', 'JAEMIN', 'CHENLE', 'JISUNG'],
  },
  {
    name: 'Stray Kids',
    type: 'male',
    members: ['BANG CHAN', 'LEE KNOW', 'CHANGBIN', 'HYUNJIN', 'HAN', 'FELIX', 'SEUNGMIN', 'I.N'],
  },
  {
    name: 'ATEEZ',
    type: 'male',
    members: ['HONGJOONG', 'SEONGHWA', 'YUNHO', 'YEOSANG', 'SAN', 'MINGI', 'WOOYOUNG', 'JONGHO'],
  },
  { name: 'TXT', type: 'male', members: ['SOOBIN', 'YEONJUN', 'BEOMGYU', 'TAEHYUN', 'HUENINGKAI'] },
  {
    name: 'ENHYPEN',
    type: 'male',
    members: ['JUNGWON', 'HEESEUNG', 'JAY', 'JAKE', 'SUNGHOON', 'SUNOO', 'NI-KI'],
  },
  { name: 'SHINee', type: 'male', members: ['ONEW', 'KEY', 'MINHO', 'TAEMIN'] },
  {
    name: 'MONSTA X',
    type: 'male',
    members: ['SHOWNU', 'MINHYUK', 'KIHYUN', 'HYUNGWON', 'JOOHONEY', 'I.M'],
  },
  {
    name: 'GOT7',
    type: 'male',
    members: ['JAY B', 'MARK', 'JACKSON', 'JINYOUNG', 'YOUNGJAE', 'BAMBAM', 'YUGYEOM'],
  },
  { name: 'WINNER', type: 'male', members: ['YOON', 'JINU', 'HOONY', 'MINO'] },
  { name: 'iKON', type: 'male', members: ['JAY', 'SONG', 'BOBBY', 'DK', 'JU-NE', 'CHAN'] },
  {
    name: 'ASTRO',
    type: 'male',
    members: ['MJ', 'JINJIN', 'CHA EUN-WOO', 'MOON BIN', 'ROCKY', 'YOON SAN-HA'],
  },
  {
    name: 'RIIZE',
    type: 'male',
    members: ['SHOTARO', 'EUNSEOK', 'SUNGCHAN', 'WONBIN', 'SOHEE', 'ANTON'],
  },
  {
    name: 'ZEROBASEONE',
    type: 'male',
    members: [
      'SUNG HANBIN',
      'KIM JIWOONG',
      'ZHANG HAO',
      'SEOK MATTHEW',
      'KIM TAE RAE',
      'RICKY',
      'KIM GYUVIN',
      'PARK GUNWOOK',
      'HAN YUJIN',
    ],
  },
  {
    name: 'BOYNEXTDOOR',
    type: 'male',
    members: ['SUNGHO', 'RIWOO', 'JAEHYUN', 'TAESAN', 'LEEHAN', 'WOONHAK'],
  },
  {
    name: 'TREASURE',
    type: 'male',
    members: [
      'CHOI HYUNSUK',
      'JIHOON',
      'YOSHI',
      'JUNKYU',
      'YOON JAEHYUK',
      'ASAHI',
      'DOYOUNG',
      'HARUTO',
      'PARK JEONGWOO',
      'SO JUNGHWAN',
    ],
  },
  {
    name: 'THE BOYZ',
    type: 'male',
    members: [
      'SANGYEON',
      'JACOB',
      'YOUNGHOON',
      'HYUNJAE',
      'JUYEON',
      'KEVIN',
      'NEW',
      'Q',
      'JUHAKNYEON',
      'SUNWOO',
      'ERIC',
    ],
  },
  {
    name: 'P1Harmony',
    type: 'male',
    members: ['KEEHO', 'THEO', 'JIUNG', 'INTAK', 'SOUL', 'JONGSEOB'],
  },
  { name: 'ONEUS', type: 'male', members: ['SEOHO', 'LEEDO', 'KEONHEE', 'HWANWOONG', 'XION'] },
  {
    name: 'BTOB',
    type: 'male',
    members: ['EUNKWANG', 'MINHYUK', 'CHANGSUB', 'HYUNSIK', 'PENIEL', 'SUNGJAE'],
  },
  {
    name: 'INFINITE',
    type: 'male',
    members: ['SUNGKYU', 'DONGWOO', 'WOOHYUN', 'SUNGYEOL', 'L', 'SUNGJONG'],
  },
  {
    name: '2PM',
    type: 'male',
    members: ['JUN. K', 'NICHKHUN', 'TAECYEON', 'WOOYOUNG', 'JUNHO', 'CHANSUNG'],
  },
  { name: 'KARD', type: 'mixed', members: ['J.SEPH', 'BM', 'SOMIN', 'JIWOO'] },
  { name: 'AKMU', type: 'mixed', members: ['LEE CHANHYUK', 'LEE SUHYUN'] },
  { name: 'Triple H', type: 'mixed', members: ['HYUNA', 'HUI', "E'DAWN"] },
];

const EVENTS = [
  'MCOUNTDOWN',
  'MUSICCORE',
  'SBS INKIGAYO',
  'MUSICBANK',
  'THE SHOW',
  'SHOW CHAMPION',
];

function esc(value: string) {
  return value.replace(/'/g, "''");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dictionary_groups', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable().unique();
    t.text('type').notNullable();
    t.boolean('active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('dictionary_artists', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable();
    t.integer('group_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_groups')
      .onDelete('CASCADE');
    t.unique(['name', 'group_id']);
  });

  await knex.schema.createTable('dictionary_songs', (t) => {
    t.increments('id').primary();
    t.text('title').notNullable();
    t.text('artist');
  });

  await knex.schema.createTable('dictionary_events', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable().unique();
  });

  await knex.schema.createTable('settings', (t) => {
    t.text('key').primary();
    t.text('value').notNullable();
  });

  for (const g of GROUPS) {
    await knex.raw(
      `INSERT INTO dictionary_groups (name, type, active) VALUES ('${esc(g.name)}', '${g.type}', 1)`,
    );
    const row = await knex('dictionary_groups').where({ name: g.name }).first('id');
    for (const m of g.members) {
      await knex.raw(
        `INSERT INTO dictionary_artists (name, group_id) VALUES ('${esc(m)}', ${row.id})`,
      );
    }
  }

  for (const event of EVENTS) {
    await knex.raw(`INSERT INTO dictionary_events (name) VALUES ('${esc(event)}')`);
  }
  await knex.raw("INSERT INTO settings (key, value) VALUES ('visible_group_types','female,mixed')");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('dictionary_events');
  await knex.schema.dropTableIfExists('dictionary_songs');
  await knex.schema.dropTableIfExists('dictionary_artists');
  await knex.schema.dropTableIfExists('dictionary_groups');
}
