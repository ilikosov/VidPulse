// fancamParser.ts

export interface ParsedResult {
  isFancam: boolean;
  originalTitle: string;
  group?: string;
  artist?: string;
  song?: string;
  date?: string; // "YYYY-MM-DD" or undefined
  venue?: string; // English venue / event description
}

// ---- DICTIONARIES ----

const groupsMap: Record<string, string> = {
  // English aliases
  QWER: 'QWER',
  'JEON SOMI': 'JEON SOMI',
  NEXZ: 'NEXZ',
  CORTIS: 'CORTIS',
  KATSEYE: 'KATSEYE',
  'SANTOS BRAVOS': 'SANTOS BRAVOS',
  moyo: 'moyo',
  'LEE CHAEYEON': 'LEE CHAEYEON',
  '&TEAM': '&TEAM',
  KickFlip: 'KickFlip',
  IVE: 'IVE',
  STAYC: 'STAYC',
  Hearts2Hearts: 'Hearts2Hearts',
  NMIXX: 'NMIXX',
  'KISS OF LIFE': 'KISS OF LIFE',
  Kep1er: 'Kep1er',
  aespa: 'aespa',
  KEYVITUP: 'KEYVITUP',
  tripleS: 'tripleS',
  EVERGLOW: 'EVERGLOW',
  YeoJin: 'YeoJin',
  TXT: 'TXT',
  KINO: 'KINO',
  RedVelvet: 'Red Velvet',
  Billlie: 'Billlie',
  ARTMS: 'ARTMS',
  S2iT: 'S2iT',
  'DIVA-X': 'DIVA-X',
  'SAY MY NAME': 'SAY MY NAME',
  NAVILLERA: 'NAVILLERA',
  TAERI: 'TAERI',
  'H1-KEY': 'H1-KEY',
  VERIVERY: 'VERIVERY',
  'Baby DONT Cry': 'Baby DONT Cry',
  'JANG HANEUM': 'JANG HANEUM',
  YENA: 'YENA',
  'LE SSERAFIM': 'LE SSERAFIM',
  fromis_9: 'fromis_9',
  LIGHTSUM: 'LIGHTSUM',
  'ODD YOUTH': 'ODD YOUTH',
  "ICHILLIN'": "ICHILLIN'",
  UNIS: 'UNIS',
  P1Harmony: 'P1Harmony',
  NouerA: 'NouerA',
  ITZY: 'ITZY',
  BTS: 'BTS',
  'i-dle': '(G)I-DLE',

  // Korean names → English
  아이브: 'IVE',
  르세라핌: 'LE SSERAFIM',
  에스파: 'aespa',
  트리플에스: 'tripleS',
  있지: 'ITZY',
  엔믹스: 'NMIXX',
  하츠투하츠: 'Hearts2Hearts',
  스테이씨: 'STAYC',
  라잇썸: 'LIGHTSUM',
  빌리: 'Billlie',
  오드유스: 'ODD YOUTH',
  키스오브라이프: 'KISS OF LIFE',
  아이칠린: "ICHILLIN'",
  유니스: 'UNIS',
  케플러: 'Kep1er',
  넥스지: 'NEXZ',
  캣츠아이: 'KATSEYE',
  '산토스 브라보스': 'SANTOS BRAVOS',
  코르티스: 'CORTIS',
  전소미: 'JEON SOMI',
  최예나: 'YENA',
};

const artistsMap: Record<string, string> = {
  // QWER
  쵸단: 'Chodan',
  chodan: 'Chodan',
  Chodan: 'Chodan',
  // NEXZ
  휴이: 'HYUI',
  HYUI: 'HYUI',
  // CORTIS
  성현: 'SEONGHYEON',
  SEONGHYEON: 'SEONGHYEON',
  // KATSEYE
  메간: 'Megan',
  Megan: 'Megan',
  // SANTOS BRAVOS
  드루: 'Drew',
  Drew: 'Drew',
  케네스: 'Kenneth',
  Kenneth: 'Kenneth',
  // IVE
  안유진: 'AN YUJIN',
  'AN YUJIN': 'AN YUJIN',
  이서: 'LEESEO',
  LEESEO: 'LEESEO',
  가을: 'GAEUL',
  GAEUL: 'GAEUL',
  리즈: 'LIZ',
  LIZ: 'LIZ',
  // LE SSERAFIM
  김채원: 'KIM CHAEWON',
  'KIM CHAEWON': 'KIM CHAEWON',
  KIMCHAEWON: 'KIM CHAEWON',
  Chaewon: 'KIM CHAEWON',
  홍은채: 'HONG EUNCHAE',
  'HONG EUNCHAE': 'HONG EUNCHAE',
  // aespa
  카리나: 'KARINA',
  KARINA: 'KARINA',
  Karina: 'KARINA',
  지젤: 'GISELLE',
  GISELLE: 'GISELLE',
  // ITZY
  유나: 'YUNA',
  YUNA: 'YUNA',
  채령: 'CHAERYEONG',
  CHAERYEONG: 'CHAERYEONG',
  // NMIXX
  설윤: 'SULLYOON',
  SULLYOON: 'SULLYOON',
  // STAYC
  아이사: 'ISA',
  ISA: 'ISA',
  재이: 'J',
  J: 'J',
  세은: 'SEEUN',
  SEEUN: 'SEEUN',
  수민: 'SUMIN',
  SUMIN: 'SUMIN',
  // Hearts2Hearts
  이안: 'IAN',
  IAN: 'IAN',
  // KISS OF LIFE
  하늘: 'HANEUL',
  HANEUL: 'HANEUL',
  // TRI.BE? not present
  // Kep1er
  다연: 'DAYEON',
  DAYEON: 'DAYEON',
  // Billlie
  문수아: 'MOON SUA',
  'MOON SUA': 'MOON SUA',
  // ARTMS
  희진: 'HEEJIN',
  HEEJIN: 'HEEJIN',
  진솔: 'JINSOL',
  JINSOL: 'JINSOL',
  // tripleS
  정하연: 'Jeong HaYeon',
  'Jeong HaYeon': 'Jeong HaYeon',
  김채연: 'Kim ChaeYeon',
  'Kim ChaeYeon': 'Kim ChaeYeon',
  // ICHILLIN'
  이지: 'E.JI',
  'E.JI': 'E.JI',
  // ODD YOUTH
  써머: 'SUMMER',
  SUMMER: 'SUMMER',
  예음: 'YEEUM',
  YEEUM: 'YEEUM',
  // UNIS
  임서원: 'SEOWON',
  SEOWON: 'SEOWON',
  나나: 'NANA',
  NANA: 'NANA',
  // LIGHTSUM
  나영: 'NAYOUNG',
  NAYOUNG: 'NAYOUNG',
  // H1-KEY
  옐: 'YEL',
  YEL: 'YEL',
  // &TEAM
  유마: 'YUMA',
  YUMA: 'YUMA',
  // KickFlip
  동현: 'DONGHYEON',
  DONGHYEON: 'DONGHYEON',
  // S2iT
  승비: 'SEUNGBI',
  SEUNGBI: 'SEUNGBI',
  // fromis_9
  백지헌: 'BAEK JIHEON',
  'BAEK JIHEON': 'BAEK JIHEON',
  // i-dle
  미연: 'MIYEON',
  MIYEON: 'MIYEON',
  // BTS (not needed but possible)
  정혜인: 'JEONG HYEIN', // just an example if needed
};

const songsMap: Record<string, string> = {
  대관람차: 'Ferris Wheel',
  'Ferris Wheel': 'Ferris Wheel',
  Discord: 'Discord',
  고민중독: 'T.B.H',
  'T.B.H': 'T.B.H',
  금금금: 'Gold Gold Gold',
  'BANG BANG': 'BANG BANG',
  WOW: 'WOW',
  'OFF THE RECORD': 'OFF THE RECORD',
  FLU: 'FLU',
  STAR: 'STAR',
  Mmchk: 'Mmchk',
  REDRED: 'REDRED',
  'PINKY UP': 'PINKY UP',
  VELOCIDADE: 'VELOCIDADE',
  누구야: 'Who Are You?',
  Crescendo: 'Crescendo',
  'Who is she': 'Who is she',
  KILLA: 'KILLA',
  HEYA: 'HEYA',
  Rude: 'Rude',
  'RUDE!': 'RUDE!',
  'Speed Love': 'Speed Love',
  Password: 'Password',
  'Sugar talk': 'Sugar talk',
  CODE: 'CODE',
  KEYVITUP: 'KEYVITUP',
  CELEBRATION: 'CELEBRATION',
  ATTITUDE: 'ATTITUDE',
  'Come Over': 'Come Over',
  ASH: 'ASH',
  'Swan Song': 'SWAN SONG',
  'SWAN SONG': 'SWAN SONG',
  'No Celestial': 'No Celestial',
  'NO CELESTIAL': 'No Celestial',
  Serenade: 'Serenade',
  "Can't Take My Eyes off You": "Can't Take My Eyes off You",
  Taxi: 'TAXI',
  TAXI: 'TAXI',
  '하루에 하루만 더': 'Stick With You',
  'Stick With You': 'Stick With You',
  'Biggest Fan': 'Biggest Fan',
  Bittersweet: 'Bittersweet',
  WANNA: 'WANNA',
  'Catch Catch': 'Catch Catch',
  '캐치 캐치': 'Catch Catch',
  'Ice Cream': 'Ice Cream',
  '나의 첫사랑에게': 'To. My First Love',
  'To. My First Love': 'To. My First Love',
  좋아좋아: 'Good Good',
  'Teddy Bear': 'Teddy Bear',
  'Teddy Bear(Chinese Ver.)': 'Teddy Bear',
  'Girl Crush': 'Girl Crush',
  'NO LIMIT': 'NO LIMIT',
  'HOT SAUCE': 'HOT SAUCE',
  GingaMingaYo: 'GingaMingaYo',
  EUNOIA: 'EUNOIA',
  'RING ma Bell': 'RING ma Bell',
  'Shut Up': 'Shut Up',
  Babyface: 'Babyface',
  'POP IT LIKE': 'POP IT LIKE',
  UNIQUE: 'UNIQUE',
};

const venuesMap: Record<string, string> = {
  '영남대학교 축제': 'Yeungnam University Festival',
  '카스쿨 페스티벌': 'CassCool Festival',
  'CassCool Festival': 'CassCool Festival',
  'SBS Inkigayo': 'SBS Inkigayo',
  'SBS Inkigayo ON THE GO': 'SBS Inkigayo ON THE GO',
  'KBS 방송': 'KBS',
  MBC방송: 'MBC',
  MBC: 'MBC',
  'Show! MusicCore': 'Show! Music Core',
  광주왕실도자기페스티벌: 'Gwangju Royal Ceramic Festival',
  '서산 어린이축제': "Seosan Children's Festival",
  '신촌 유플렉스LVN 한류문화공동체': 'Sinchon U-Plex LVN Hallyu Community',
  '우송정보대학교 우정 페스티벌': 'Woosong College Wujeong Festival',
  '경일대학교 축제': 'Kyungil University Festival',
  '서산시 어린이가족큰잔치': 'Seosan City Children and Family Festival',
  '동대문구 봄꽃축제': 'Dongdaemun Spring Flower Festival',
  '여의도한강공원 버스킹': 'Yeouido Hangang Park Busking',
  '홍대 Red Road K-POP FESTIVAL': 'Hongdae Red Road K-POP Festival',
  기지시줄다리기축제: 'Gijisi Juldarigi Festival',
  '419혁명문화제 락뮤직페스티벌': '419 Revolution Culture Rock Music Festival',
  아산이순신축제: 'Asan Yi Sun-sin Festival',
  'K-메디웨이브 음악회': 'K-Medi Wave Concert',
  '명지대 자연캠퍼스 축제': 'Myongji University Festival',
  '한강 대학가요제': 'Hangang University Song Festival',
  '세명대 벚꽃축제': 'Semyung University Cherry Blossom Festival',
  '정읍 벚꽃축제': 'Jeongeup Cherry Blossom Festival',
  '안성스타필드 모두의 동행 축제': "Anseong Starfield Everyone's Companion Festival",
  '충북산업과학고등학교 축제': 'Chungbuk Industrial Science High School Festival',
  '대한민국 축제 엑스포': 'Korea Festival Expo',
  'SHOW WHAT I AM': 'SHOW WHAT I AM',
};

// ---- HELPERS ----

function yymmddToDate(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);
  const year = 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

function extractDate(title: string): { date?: string; cleaned: string } {
  const match = title.match(/\b(\d{6})\b/g);
  if (match && match.length > 0) {
    const raw = match[0];
    const parsed = yymmddToDate(raw);
    // Remove only that specific occurrence to avoid removing other numbers
    const cleaned = title
      .replace(raw, '')
      .replace(/\s*,\s*/g, ' ')
      .trim();
    return { date: parsed, cleaned };
  }
  return { date: undefined, cleaned: title };
}

function extractSong(title: string): { song?: string; cleaned: string } {
  // Try single quotes (’‘) and double quotes, also Korean corner brackets 「」
  const patterns = [
    /['\u2018]([^'\u2018\u2019]+)['\u2019]/u, // ‘...’
    /['\u201C]([^'\u201C\u201D]+)['\u201D]/u, // “...”
    /「([^」]+)」/u,
    /'([^']+)'/,
    /"([^"]+)"/,
  ];
  for (const regex of patterns) {
    const match = title.match(regex);
    if (match) {
      const rawSong = match[1].trim();
      // Clean out the matched quote from title
      const cleaned = title.replace(match[0], '').trim();
      // Map to English if possible
      const englishSong = songsMap[rawSong] || songsMap[rawSong.toLowerCase()] || rawSong;
      return { song: englishSong, cleaned };
    }
  }
  // No quotes: try " - Song" pattern (for highlights)
  const dashMatch = title.match(/\s-\s(.+?)(?:\s*[\[|@]|$)/);
  if (dashMatch) {
    const rawSong = dashMatch[1].trim();
    const cleaned = title.replace(dashMatch[0], '').trim();
    const englishSong = songsMap[rawSong] || rawSong;
    return { song: englishSong, cleaned };
  }
  return { song: undefined, cleaned: title };
}

function extractGroupAndArtist(title: string): {
  group?: string;
  artist?: string;
  cleaned: string;
} {
  let group: string | undefined = undefined;
  let artist: string | undefined = undefined;
  let cleaned = title;

  // Find group by checking known group names (longer first)
  const sortedGroups = Object.keys(groupsMap).sort((a, b) => b.length - a.length);
  for (const key of sortedGroups) {
    if (title.includes(key)) {
      group = groupsMap[key];
      // Remove group name from title to ease further processing
      cleaned = title.replace(key, '').trim();
      break;
    }
  }

  if (!group) {
    // Try to find an artist name as a fallback (maybe solo)
    for (const key of Object.keys(artistsMap).sort((a, b) => b.length - a.length)) {
      if (title.includes(key)) {
        artist = artistsMap[key];
        // We'll treat this as both group and artist if no group found
        group = artist;
        cleaned = title.replace(key, '').trim();
        break;
      }
    }
    return { group, artist, cleaned };
  }

  // Now extract artist name that follows the group
  // Artist can be in parentheses (e.g., 쵸단(chodan)) or directly after group
  const parenMatch = cleaned.match(/^[^(]*\(([^)]+)\)/);
  if (parenMatch) {
    const rawArtist = parenMatch[1].trim();
    artist = artistsMap[rawArtist] || artistsMap[rawArtist.toLowerCase()] || rawArtist;
    cleaned = cleaned.replace(parenMatch[0], '').trim();
  } else {
    // Try to capture the next word(s) until a quote or dash
    const wordMatch = cleaned.match(/^([A-Za-z\uAC00-\uD7AF]+(?:\s+[A-Za-z\uAC00-\uD7AF]+)*)/);
    if (wordMatch) {
      const rawArtist = wordMatch[1].trim();
      // Check if it looks like a known artist or just a word
      if (artistsMap[rawArtist] || /^[A-Z]/.test(rawArtist)) {
        artist = artistsMap[rawArtist] || rawArtist;
        cleaned = cleaned.replace(wordMatch[0], '').trim();
      }
    }
  }

  return { group, artist, cleaned };
}

function extractVenue(title: string): { venue?: string; cleaned: string } {
  let venue: string | undefined = undefined;
  let cleaned = title;

  // Look for @venue, sometimes followed by date
  const atMatch = title.match(/@\s*(.+?)(?:,\s*\d{6})?\s*(?:$|\|)/);
  if (atMatch) {
    venue = atMatch[1].trim();
    cleaned = title.replace(atMatch[0], '').trim();
  } else {
    // Try after | if no @
    const pipeMatch = title.match(/\|\s*(.+)/);
    if (pipeMatch) {
      venue = pipeMatch[1].trim();
      cleaned = title.replace(pipeMatch[0], '').trim();
    }
  }

  if (venue) {
    // Remove trailing date if present
    venue = venue.replace(/,?\s*\d{6}$/, '').trim();
    // Map to English venue if available
    venue = venuesMap[venue] || venue;
  }

  return { venue, cleaned };
}

// ---- MAIN PARSER ----

export function parseTitle(originalTitle: string): ParsedResult {
  const result: ParsedResult = {
    isFancam: false,
    originalTitle,
  };

  // Determine if fancam
  const fancamKeywords = /직캠|FanCam|FaceCam|FullCam|Focus/i;
  result.isFancam = fancamKeywords.test(originalTitle);

  // Work on a mutable copy
  let remaining = originalTitle;

  // 1. Extract date first (so it doesn't interfere with other parts)
  const dateResult = extractDate(remaining);
  result.date = dateResult.date;
  remaining = dateResult.cleaned;

  // 2. Extract song
  const songResult = extractSong(remaining);
  result.song = songResult.song;
  remaining = songResult.cleaned;

  // 3. Extract group and artist
  const gaResult = extractGroupAndArtist(remaining);
  result.group = gaResult.group;
  result.artist = gaResult.artist;
  remaining = gaResult.cleaned;

  // 4. Extract venue (from what's left, may already contain it)
  if (!result.venue) {
    const venueResult = extractVenue(remaining);
    result.venue = venueResult.venue;
    remaining = venueResult.cleaned;
  }

  // If no venue found in remaining, try original title again (because group extraction might have removed it)
  if (!result.venue) {
    const v2 = extractVenue(originalTitle);
    result.venue = v2.venue;
  }

  // Clean up: if artist still not found but some parenthesised name exists in original, try again
  if (!result.artist) {
    const fallbackParen = originalTitle.match(/\(([^)]+)\)/);
    if (fallbackParen) {
      const raw = fallbackParen[1].trim();
      result.artist = artistsMap[raw] || raw;
    }
  }

  return result;
}
