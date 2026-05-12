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

    return cameraPatterns.find(({ pattern }) => pattern.test(title))?.value;
  }

  private extractEvent(title: string): string | undefined {
    const atMatch = title.match(/@\s*([^|\]\[()]+?)(?=\s+\d{6}\b|\s*$|\s+\||\s+방송)/i);
    if (atMatch?.[1]) {
      const raw = this.compact(atMatch[1])
        .replace(/\b\d{6}\b/g, '')
        .trim();
      return raw ? `@${/[A-Za-z]/.test(raw) ? raw.toUpperCase() : raw}` : undefined;
    }

    const pipeMatch = title.match(/\|\s*([A-Za-z]+)\s+\d{6}\s+방송/i);
    if (pipeMatch?.[1]) {
      return `@${pipeMatch[1].toUpperCase()}`;
    }

    return undefined;
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

    return undefined;
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
    const koreanParen = source.match(/\b([가-힣A-Za-z0-9]+)\s+([가-힣]+)\s*\([A-Za-z]+\)/);
    if (koreanParen) {
      return { group_name: koreanParen[1], artist_name: koreanParen[2] };
    }

    const koreanCam = source.match(/\b([가-힣A-Za-z0-9]+)\s+([가-힣]+)\s+직캠/);
    if (koreanCam) {
      return { group_name: koreanCam[1], artist_name: koreanCam[2] };
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
      /(fan\s?cam|face\s?cam|직캠|페이스캠|얼빡직캠|focus|포커스|\([^)]+\s+fan\s?cam\))/i;
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
