import { ParsedMetadata, ParserModule } from './parser.types';

export class RegexModule implements ParserModule {
  private readonly datePattern = /\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\b/g;

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

    const englishFancamMeta = this.extractFromEnglishFancamParen(compacted);
    const koreanPrefixMeta = this.extractKoreanPrefix(compacted, metadata.song_title);
    Object.assign(metadata, englishFancamMeta, koreanPrefixMeta);

    const fancam = this.assessFancam(compacted);
    metadata.is_fancam = fancam.is_fancam;
    metadata.fancam_confidence = fancam.fancam_confidence;

    return metadata;
  }

  private compact(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private extractLastDate(title: string): string | undefined {
    const matches = [...title.matchAll(this.datePattern)];
    return matches.length > 0 ? matches[matches.length - 1][1] : undefined;
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
    return this.compact(rawEvent)
      .replace(/\b\d{6}\b/g, '')
      .replace(/#.*$/g, '')
      .replace(/\b방송\b/gi, '')
      .trim();
  }

  private extractSongTitle(title: string): string | undefined {
    const quotePatterns = [
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
    return title.replace(/^\s*\d{6}\s+/, '').trim();
  }

  private stripTrailingCameraMarkers(value: string): string {
    return value
      .replace(/\s*\((?:\d+K\s+)?FAN\s?CAM\)\s*$/i, '')
      .replace(/\s*\(FACECAM\)\s*$/i, '')
      .replace(/\s*\[(?:\d+K)\]\s*$/i, '')
      .trim();
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
    if (!match?.[3]) {
      return undefined;
    }

    const song = this.stripTrailingCameraMarkers(this.compact(match[3]));
    return song || undefined;
  }

  private extractFromEnglishFancamParen(title: string): Partial<ParsedMetadata> {
    const match = title.match(/\(([A-Za-z0-9&\s'.-]+?)\s+([A-Za-z0-9'.-]+)\s+Fan\s?Cam\)/i);
    if (!match) {
      return {};
    }

    return {
      group_name: this.compact(match[1]),
      artist_name: this.compact(match[2]),
    };
  }

  private extractKoreanPrefix(title: string, songTitle?: string): Partial<ParsedMetadata> {
    const source = songTitle ? title.split(songTitle)[0] : title;
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
      if (koreanEventFallback) {
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
