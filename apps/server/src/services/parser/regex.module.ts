import { ParsedMetadata, ParserModule } from './parser.types';

/** Sentinel group name for a solo stage (a single performer, no group credited). */
export const SOLO_GROUP = 'SOLO';

export class RegexModule implements ParserModule {
  private readonly datePattern = /\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\b/g;

  // MPD-style dotted dates: "@MCOUNTDOWN_2026.5.14" / "26.5.14" → "260514".
  // (?<!\d) instead of \b — "_" before the year is a word char, so \b never fires there.
  private readonly dottedDatePattern = /(?<!\d)(20\d{2}|\d{2})\.(\d{1,2})\.(\d{1,2})(?!\d)/g;

  async parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>,
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }> {
    const parsed = this.parseTitle(title);
    const metadata: Partial<ParsedMetadata> = {
      ...parsed,
      ...currentMeta,
    };

    return { metadata, confidence: this.score(metadata) };
  }

  private parseTitle(title: string): Partial<ParsedMetadata> {
    const compacted = this.compact(title);
    const metadata: Partial<ParsedMetadata> = {
      perf_date: this.extractLastDate(compacted),
      camera_type: this.extractCameraType(compacted),
      event: this.extractEvent(compacted),
      song_title: this.extractSongTitle(compacted),
    };

    const englishFancamMeta = this.extractFancamCredit(compacted);
    const koreanPrefixMeta = this.extractKoreanPrefix(compacted, metadata.song_title);
    Object.assign(metadata, englishFancamMeta, koreanPrefixMeta);

    // Show-channel titles ("[channel] group artist | song, song | SHOW") are pipe-segmented
    // rather than quote/@-delimited, so the generic extractors above misread them. When the
    // structural parse recognises that shape it wins, overriding event/songs/credit.
    const segmentedMeta = this.parseSegmentedTitle(compacted);
    if (segmentedMeta) {
      Object.assign(metadata, segmentedMeta);
    }

    const fancam = this.assessFancam(compacted);
    metadata.is_fancam = fancam.is_fancam;
    metadata.fancam_confidence = fancam.fancam_confidence;

    return metadata;
  }

  private compact(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private extractLastDate(title: string): string | undefined {
    const leadingDateRange = title.match(/^\s*(\d{6})(?:\s*[-~–—]\s*(?:\d{2}|\d{6}))?\b/);
    if (leadingDateRange?.[1]) {
      return leadingDateRange[1];
    }

    const matches = [...title.matchAll(this.datePattern)];
    if (matches.length > 0) {
      return matches[matches.length - 1][1];
    }

    // Fallback: dotted "YYYY.M.D" / "YY.M.D" dates, normalized to YYMMDD. Month/day range
    // checks keep version-like numbers ("1.2.345") from being read as dates.
    const dotted = [...title.matchAll(this.dottedDatePattern)]
      .map(([, year, month, day]) => ({
        year: year.slice(-2),
        month: Number(month),
        day: Number(day),
      }))
      .filter(({ month, day }) => month >= 1 && month <= 12 && day >= 1 && day <= 31);
    if (dotted.length > 0) {
      const last = dotted[dotted.length - 1];
      return `${last.year}${String(last.month).padStart(2, '0')}${String(last.day).padStart(2, '0')}`;
    }

    return undefined;
  }

  private extractCameraType(title: string): string | undefined {
    const cameraPatterns: Array<{ pattern: RegExp; value: string }> = [
      { pattern: /\bunfiltered\s+cam\b/i, value: 'UNFILTERED CAM' },
      { pattern: /\b8k\b/i, value: '8K' },
      { pattern: /\b4k\b/i, value: '4K' },
      { pattern: /\bface\s?cam\b/i, value: 'FaceCam' },
      { pattern: /\bfull\s?cam\b/i, value: 'FullCam' },
      { pattern: /\bchoreography\b/i, value: 'Choreography' },
      { pattern: /\bfan\s?cam\b/i, value: 'FanCam' },
      { pattern: /얼빡직캠/, value: '얼빡직캠' },
      { pattern: /페이스캠/, value: '페이스캠' },
      { pattern: /직캠/, value: '직캠' },
      { pattern: /세로/, value: '세로' },
      { pattern: /가로/, value: '가로' },
    ];

    const found = cameraPatterns
      .filter(({ pattern }) => pattern.test(title))
      .map(({ value }) => value)
      .filter((value, index, arr) => arr.indexOf(value) === index);

    return found.length > 0 ? found.join(' ') : undefined;
  }

  private extractEvent(title: string): string | undefined {
    const atMatch = title.match(/@\s*([^|\]\[()#]+(?:\s+[^|\]\[()#]+)*)/i);
    if (atMatch?.[1]) {
      const cleaned = this.cleanEvent(atMatch[1]);
      return cleaned ? `@${/[A-Za-z]/.test(cleaned) ? cleaned.toUpperCase() : cleaned}` : undefined;
    }

    const pipeMatch = title.match(/\|\s*([^|\[\]]+)/);
    if (pipeMatch?.[1]) {
      const cleaned = this.cleanEvent(pipeMatch[1])
        .replace(/[\s,.-]+$/g, '')
        .trim();
      if (cleaned) {
        return `@${/[A-Za-z]/.test(cleaned) ? cleaned.toUpperCase() : cleaned}`;
      }
    }

    return undefined;
  }

  private cleanEvent(rawEvent: string): string {
    return (
      this.compact(rawEvent)
        .replace(/\b\d{6}\b/g, '')
        // Dotted dates with an optional leading separator, e.g. "MCOUNTDOWN_2024.9.26".
        .replace(/[_\s-]*(?<!\d)(?:20\d{2}|\d{2})\.\d{1,2}\.\d{1,2}(?!\d)/g, '')
        // Underscore-joined 6-digit dates (the \b above misses these — "_" is a word char).
        .replace(/[_\s-]+\d{6}(?!\d)/g, '')
        .replace(/#.*$/g, '')
        .replace(/\b방송\b/gi, '')
        // Drop the decorative "쇼!" (Show!) prefix so "쇼! 음악중심" → "음악중심".
        .replace(/^쇼!\s*/, '')
        .replace(/[_\s.-]+$/g, '')
        .trim()
    );
  }

  /**
   * Parse show-channel titles of the form
   * `[channel] group artist [with guest] | song, song, ... | SHOW NAME (langs)`.
   *
   * These use `|` as a structural separator (credit / song-list / show), so the generic
   * single-pipe `extractEvent` would grab the song list as the event. Only fires when the
   * title has at least three pipe segments and no `@` (the @-fancam format is handled
   * elsewhere). Returns null when the shape does not match, leaving the generic path intact.
   */
  private parseSegmentedTitle(title: string): Partial<ParsedMetadata> | null {
    const withoutTag = this.compact(title.replace(/^\s*\[[^\]]+\]\s*/, ''));
    if (withoutTag.includes('@')) {
      return null;
    }

    let segments = withoutTag.split('|').map((segment) => this.compact(segment));

    // A trailing "broadcaster + YYMMDD" segment ("MBC250503") is the air date, not the show.
    // Pull the date out and let the preceding segment be the show.
    let broadcasterDate: string | undefined;
    const lastSeg = segments[segments.length - 1] ?? '';
    const bcastMatch = lastSeg.match(
      /^[A-Za-z]{2,4}\s?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/,
    );
    if (segments.length >= 2 && bcastMatch) {
      broadcasterDate = bcastMatch[1];
      segments = segments.slice(0, -1);
    }

    // The default shape needs three segments (credit | songs | show); the broadcaster variant
    // may legitimately have two (credit | show) once the date segment is removed.
    if (segments.length < 3 && !broadcasterDate) {
      return null;
    }
    if (segments.length < 2) {
      return null;
    }

    const metadata: Partial<ParsedMetadata> = {};
    if (broadcasterDate) {
      metadata.perf_date = broadcasterDate;
    }

    // Last segment is the event/show; drop trailing parentheticals like "(ENG/JPN)".
    const eventRaw = this.cleanEvent(segments[segments.length - 1].replace(/\([^)]*\)/g, ''));
    if (eventRaw) {
      metadata.event = `@${/[A-Za-z]/.test(eventRaw) ? eventRaw.toUpperCase() : eventRaw}`;
    }

    // Middle segments hold a comma-separated song list.
    const songs = segments
      .slice(1, -1)
      .join(',')
      .split(',')
      .map((song) => this.compact(song))
      .filter(Boolean);
    if (songs.length) {
      metadata.song_titles = songs;
      metadata.song_title = songs[songs.length - 1];
    }

    // First segment is the credit. It is either a plain "group artist [with guest]" or carries
    // the song + camera after a dash: "GROUP ARTIST (한글 alias) – SONG FanCam".
    let creditPart = segments[0];
    const dashSong = creditPart.match(/\s[–—-]\s+(.+)$/);
    if (dashSong) {
      const songRaw = this.compact(dashSong[1].replace(/\([^)]*\)/g, ' '))
        .replace(
          /(?:\s+(?:fan\s?cam|face\s?cam|full\s?cam|multi\s?cam|[48]k|직캠|페이스캠|얼빡직캠|풀캠))+\s*$/i,
          '',
        )
        .trim();
      if (songRaw && !metadata.song_title) {
        metadata.song_title = songRaw;
        metadata.song_titles = [songRaw];
      }
      creditPart = this.compact(creditPart.slice(0, dashSong.index ?? 0));
    }
    // Drop a "(한글 alias)" parenthetical so the leading English credit is left to match.
    creditPart = this.compact(creditPart.replace(/\([^)]*\)/g, ' '));
    const credit = creditPart.match(
      /^([가-힣A-Za-z0-9_&.-]+)\s+([가-힣A-Za-z0-9'.-]+)(?:\s+with\s+.+)?$/i,
    );
    if (credit && !this.looksLikeDateToken(credit[1])) {
      metadata.group_name = credit[1];
      metadata.artist_name = credit[2];
    }

    return Object.keys(metadata).length ? metadata : null;
  }

  private extractSongTitle(title: string): string | undefined {
    const quotePatterns = [
      // Apostrophe-aware single quotes: the closing quote is the one followed by a
      // delimiter, so apostrophes *inside* the title (e.g. `What's`, `Eye-Poppin')`)
      // no longer truncate it. Falls back to the simple pattern below when needed.
      /(?<=^|[\s\[\]("])'(.+?)'(?=$|[\s|\]@])/,
      /'([^']+)'/,
      /"([^"]+)"/,
      /‘([^’]+)’/,
      /“([^”]+)”/,
      /「([^」]+)」/,
      /＜([^＞]+)＞/,
    ];

    for (const pattern of quotePatterns) {
      const match = title.match(pattern);
      if (match?.[1]) {
        return this.compact(match[1]);
      }
    }

    const dashed = title.match(/^\s*([^|\-]+?)\s*-\s*([^|]+?)\s*\|/);
    if (dashed) {
      const left = this.compact(dashed[1]);
      const right = this.compact(dashed[2]);
      const leftUpper = left.toUpperCase();
      return /^[A-Z0-9\s&'.-]+$/.test(leftUpper) ? right : left;
    }

    const bareSong = this.extractBareSongBeforeEvent(title);
    if (bareSong) {
      return bareSong;
    }

    return undefined;
  }

  private stripLeadingDate(title: string): string {
    return this.compact(title.replace(/^\s*\d{6}(?:\s*[-~–—]\s*(?:\d{2}|\d{6}))?\s+/, ''));
  }

  private looksLikeDateToken(value: string): boolean {
    return /^\d{6}(?:[-~–—](?:\d{2}|\d{6}))?$/.test(value.trim());
  }

  private stripTrailingCameraMarkers(value: string): string {
    return this.compact(
      value
        .replace(
          /\s*[\[(][^\])]*(?:fan\s?cam|face\s?cam|full\s?cam|multi\s?cam|직캠|페이스캠|4k|8k)[^\])]*[\])]\s*$/i,
          '',
        )
        .trim(),
    );
  }

  private extractBareSongBeforeEvent(title: string): string | undefined {
    const stripped = this.stripLeadingDate(title);
    const beforeAt = stripped.match(/^(.+?)\s+@/);
    const left = beforeAt?.[1];
    if (!left) {
      return undefined;
    }

    const cleanedLeft = this.stripTrailingCameraMarkers(left)
      .replace(/^\[[^\]]+\]\s*/g, '')
      .trim();
    const match = cleanedLeft.match(/^([가-힣A-Za-z0-9_&.-]+)\s+([가-힣A-Za-z0-9_&'.-]+)\s+(.+)$/);
    if (!match?.[3] || this.looksLikeDateToken(match[1])) {
      return undefined;
    }

    const song = this.stripTrailingCameraMarkers(this.compact(match[3]));
    return song || undefined;
  }

  private extractFancamCredit(title: string): Partial<ParsedMetadata> {
    // Match "(... FanCam)" plus "(... FaceCam)" / "(... FullCam)". A two-word
    // "<group> <member>" credit must be honoured for every cam type — otherwise an
    // unextracted FaceCam credit lets the dictionary fuzzy-match the bare Korean
    // member name to the wrong artist/group.
    const match = title.match(/\(([A-Za-z0-9&'._\s-]+?)\s+(Fan|Face|Full)\s?Cam\)/i);
    if (!match) {
      return {};
    }

    const isFanCam = /^fan$/i.test(match[2]);

    // Drop resolution / camera-rig words so "(4K FANCAM)" or "(YUNA 4K FanCam)"
    // is not mistaken for a performer credit.
    const nameWords = this.compact(match[1])
      .split(/\s+/)
      .filter((word) => !this.isCameraNoiseWord(word));
    if (nameWords.length === 0) {
      return {};
    }

    // Two Korean name tokens in the prefix ("킥플립 동현", "베이비몬스터 아현") mean the
    // credit is "<group> <member>". A single token ("다영", "문별") is a solo stage,
    // so the whole — possibly multi-word — romanized name stays as one artist and
    // the group is flagged SOLO instead of being split apart.
    if (this.countKoreanNameTokens(title) >= 2 && nameWords.length >= 2) {
      return {
        group_name: nameWords.slice(0, -1).join(' '),
        artist_name: nameWords[nameWords.length - 1],
      };
    }

    // A single-name FaceCam/FullCam credit keeps the legacy behaviour: leave the
    // fields empty so the dictionary can infer the member's home group from
    // membership ("(YUNA FaceCam)" → ITZY). Only FanCam solo credits map to SOLO.
    if (!isFanCam) {
      return {};
    }

    return {
      group_name: SOLO_GROUP,
      artist_name: nameWords.join(' '),
    };
  }

  private isCameraNoiseWord(word: string): boolean {
    return /^(?:[48]k|fhd|uhd|hd|multi(?:cam)?|cam|unfiltered|full(?:cam)?|close-?up|focus)$/i.test(
      word,
    );
  }

  private countKoreanNameTokens(title: string): number {
    // Performer names sit between the leading "[..]" tag and the song quote.
    // Bracketed tags and parenthetical credits are not names, so drop them first.
    // Korean camera markers ("아이오아이 세정 직캠 4K") are not names either: counting
    // 직캠 made a solo credit look like "<group> <member>" and split it apart.
    const withoutTags = title.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');
    const prefix = this.stripLeadingDate(withoutTags.split(/['"‘“「＜@]/)[0]);
    return prefix
      .split(/\s+/)
      .filter((token) => /[가-힣]/.test(token) && !this.isKoreanCameraMarkerToken(token)).length;
  }

  private isKoreanCameraMarkerToken(token: string): boolean {
    return /(?:얼빡직캠|페이스캠|직캠|풀캠|세로|가로)/.test(token);
  }

  private extractKoreanPrefix(title: string, songTitle?: string): Partial<ParsedMetadata> {
    const source = songTitle ? title.split(songTitle)[0] : title;

    // "MEOVV(미야오) GAWON" — the group carries its own Korean alias in parens, followed by
    // the member. (The song is already stripped from `source`, so the trailing word is the
    // artist, not a song word.)
    const groupKoreanParenArtist = source.match(
      /(?:^|[\]\s])([A-Za-z0-9_&.-]+)\([가-힣]+\)\s+([A-Za-z][A-Za-z0-9'.-]*)/,
    );
    if (groupKoreanParenArtist) {
      return {
        group_name: this.compact(groupKoreanParenArtist[1]),
        artist_name: this.compact(groupKoreanParenArtist[2]),
      };
    }

    const englishWithKoreanParen = source.match(
      /(?:^|\]\s*)([A-Za-z0-9_&.-]+)\s+([A-Za-z][A-Za-z0-9'.-]*)\s*\([가-힣]+\)/,
    );
    if (englishWithKoreanParen) {
      return {
        group_name: this.compact(englishWithKoreanParen[1]),
        artist_name: this.compact(englishWithKoreanParen[2]),
      };
    }

    const koreanParen = source.match(/\b([가-힣A-Za-z0-9]+)\s+([가-힣]+)\s*\([A-Za-z]+\)/);
    if (koreanParen) {
      return { group_name: koreanParen[1], artist_name: koreanParen[2] };
    }

    const koreanCam = source.match(/\b([가-힣A-Za-z0-9]+)\s+([가-힣]+)\s+직캠/);
    if (koreanCam) {
      return { group_name: koreanCam[1], artist_name: koreanCam[2] };
    }

    const stripped = this.stripLeadingDate(title);
    const beforeAt = stripped.match(/^(.+?)\s+@/);
    const left = beforeAt?.[1]?.trim();
    if (left) {
      const koreanEventFallback = left.match(/^([가-힣A-Za-z0-9_&.-]+)\s+([가-힣]+)\s+.+$/);
      if (koreanEventFallback && !this.looksLikeDateToken(koreanEventFallback[1])) {
        return {
          group_name: koreanEventFallback[1],
          artist_name: koreanEventFallback[2],
        };
      }
    }

    return {};
  }

  private assessFancam(title: string): { is_fancam: boolean; fancam_confidence: number } {
    if (/private\s+video/i.test(title)) {
      return { is_fancam: false, fancam_confidence: 1 };
    }

    const negative =
      /(interview|highlight|하이라이트|teaser|trailer|\bmv\b|shorts?|#shorts|behind|비하인드|리무진서비스)/i;
    if (negative.test(title)) {
      return { is_fancam: false, fancam_confidence: 0.95 };
    }

    const positive =
      /(fan\s?cam|face\s?cam|직캠|페이스캠|얼빡직캠|focus|포커스|\([^)]+\s+fan\s?cam\)|\bunfiltered\s+cam\b|\[unfiltered\s+cam\])/i;
    if (positive.test(title)) {
      return { is_fancam: true, fancam_confidence: 0.95 };
    }

    return { is_fancam: false, fancam_confidence: 0.3 };
  }

  private score(metadata: Partial<ParsedMetadata>): number {
    if (/private\s+video/i.test(metadata.song_title ?? '')) {
      return 0;
    }
    if (metadata.is_fancam === false && metadata.fancam_confidence === 1) {
      return 0;
    }

    const weightedFields: Array<{ present: boolean; weight: number }> = [
      { present: Boolean(metadata.perf_date), weight: 0.2 },
      { present: Boolean(metadata.event), weight: 0.2 },
      { present: Boolean(metadata.song_title), weight: 0.2 },
      { present: Boolean(metadata.camera_type), weight: 0.1 },
      { present: Boolean(metadata.group_name), weight: 0.1 },
      { present: Boolean(metadata.artist_name), weight: 0.1 },
      { present: metadata.is_fancam !== undefined, weight: 0.1 },
    ];

    const base = weightedFields.reduce((acc, field) => acc + (field.present ? field.weight : 0), 0);
    const fancamFactor = metadata.fancam_confidence ?? 0.5;
    return Number(Math.min(1, base * (0.7 + fancamFactor * 0.3)).toFixed(2));
  }
}
