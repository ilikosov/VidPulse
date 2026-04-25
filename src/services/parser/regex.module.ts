import { ParserModule, ParsedMetadata } from './parser.types';

/**
 * Regex-based parser module for extracting metadata from K-pop video titles
 */
export class RegexModule implements ParserModule {
  // Date pattern: YYMMDD
  private datePattern = /\b(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\b/g;

  // Event pattern: @EVENTNAME (e.g., @MCOUNTDOWN, @MUSICCORE)
  private eventPattern = /@([A-Z0-9가-힣 !]+?)(?=\s+\[|\s+\d{6}\b|\s+(?:4k|fancam|cam)\b|$)/i;

  // Camera type keywords
  private cameraTypeKeywords = [
    'vertical fancam',
    'vertical cam',
    '4K',
    '입덕직캠',
    '직캠',
    'fancam',
    'cam',
    'full cam',
    'face cam',
    'center cam',
  ];

  // Common group name patterns (usually before song or in parentheses)
  private groupPattern =
    /(?:^|\[|\()([A-Za-z가 - 힣0-9\s&]+?)(?:\)|\]|\s+-\s+|feat\.|\s*\()\s*(?=\[|\(|@|$)/i;

  // Artist name pattern (often in "(NAME FanCam)")
  private artistPattern = /\(([^()]+?)\s*(?:fancam|face\s*cam|cam|직캠)\)/i;

  // Song title in matching quote pair
  private songPattern = /(["'])(.+?)\1(?=\s*(?:\(|@|$))/i;

  async parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>,
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }> {
    const metadata: Partial<ParsedMetadata> = { ...currentMeta };
    let fieldsExtracted = 0;
    let fieldsAttempted = 0;

    // Extract perf_date (YYMMDD)
    fieldsAttempted++;
    if (!metadata.perf_date) {
      const dateMatches = [...title.matchAll(this.datePattern)];
      if (dateMatches.length > 0) {
        metadata.perf_date = dateMatches[dateMatches.length - 1][1];
        fieldsExtracted++;
      }
    } else {
      fieldsExtracted++;
    }

    // Extract event (@EVENTNAME)
    fieldsAttempted++;
    if (!metadata.event) {
      const eventMatch = title.match(this.eventPattern);
      if (eventMatch && eventMatch[1]) {
        metadata.event = '@' + eventMatch[1].trim().toUpperCase();
        fieldsExtracted++;
      }
    } else {
      fieldsExtracted++;
    }

    // Extract camera_type
    fieldsAttempted++;
    if (!metadata.camera_type) {
      const bracketCameraMatch = title.match(/^\[([^\]]+)\]/);
      if (bracketCameraMatch?.[1]) {
        const bracketText = bracketCameraMatch[1].trim();
        if (/(4k|cam|직캠|입덕직캠)/i.test(bracketText)) {
          metadata.camera_type = bracketText;
          fieldsExtracted++;
        }
      }

      const lowerTitle = title.toLowerCase();
      if (!metadata.camera_type) {
        for (const keyword of this.cameraTypeKeywords) {
          if (lowerTitle.includes(keyword.toLowerCase())) {
            metadata.camera_type = keyword;
            fieldsExtracted++;
            break;
          }
        }
      }
    } else {
      fieldsExtracted++;
    }

    // Extract artist_name (solo fancam)
    fieldsAttempted++;
    if (!metadata.artist_name) {
      const artistMatch = title.match(this.artistPattern);
      if (artistMatch && artistMatch[1]) {
        const cleanedArtist = artistMatch[1].trim().replace(/\s+/g, ' ');
        const tokens = cleanedArtist.split(' ');
        const beforeSongText = title
          .replace(/^\[[^\]]+\]\s*/, '')
          .split(/["']/)[0]
          .trim();
        const beforeSongWordCount = beforeSongText.split(/\s+/).filter(Boolean).length;
        const potentialArtist =
          tokens.length === 2 && beforeSongWordCount <= 1 ? cleanedArtist : tokens[tokens.length - 1];
        if (!this.isCommonWord(potentialArtist) && potentialArtist.length > 1) {
          metadata.artist_name = this.normalizeName(potentialArtist);
          fieldsExtracted++;
        }
      }

      // Pattern: GROUP (ARTIST)
      if (!metadata.artist_name) {
        const groupArtistMatch = title.match(/\b\d{6}\b\s+([A-Za-z가-힣0-9][A-Za-z가-힣0-9\s&]+?)\s+\(([^)]+)\)/i);
        if (groupArtistMatch?.[2]) {
          metadata.artist_name = this.normalizeName(groupArtistMatch[2].trim());
          fieldsExtracted++;
        }
      }
    } else {
      fieldsExtracted++;
    }

    // Extract group_name
    fieldsAttempted++;
    if (!metadata.group_name) {
      const englishFanCamMatch = title.match(/\(([^()]+?)\s+(?:fancam|face\s*cam|cam)\)/i);
      if (englishFanCamMatch?.[1]) {
        const cleaned = englishFanCamMatch[1].trim().replace(/\s+/g, ' ');
        const parts = cleaned.split(' ');
        if (parts.length >= 2) {
          metadata.group_name = this.normalizeName(parts.slice(0, -1).join(' '));
          fieldsExtracted++;
        }
      }
    }

    if (!metadata.group_name) {
      const groupArtistMatch = title.match(/\b\d{6}\b\s+([A-Za-z가-힣0-9][A-Za-z가-힣0-9\s&]+?)\s+\([^)]+\)/i);
      if (groupArtistMatch?.[1]) {
        metadata.group_name = this.normalizeName(groupArtistMatch[1].trim());
        fieldsExtracted++;
      }
    }

    if (!metadata.group_name && !metadata.artist_name) {
      // Try to extract group name from various patterns
      const groupPatterns = [
        /\[([A-Za-z가 - 힣0-9&\s]+?)\](?=\s*[-|])/i, // [GROUP] - Song
        /\(([A-Za-z가 - 힣0-9&\s]+?)\)(?=\s*[-|])/i, // (GROUP) - Song
        /^([A-Za-z가 - 힣0-9&\s]+?)\s*[-|]/i, // GROUP - Song
      ];

      for (const pattern of groupPatterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
          const potentialGroup = match[1].trim();
          if (!this.isCommonWord(potentialGroup) && potentialGroup.length > 1) {
            metadata.group_name = this.normalizeName(potentialGroup);
            fieldsExtracted++;
            break;
          }
        }
      }
    } else if (metadata.group_name || metadata.artist_name) {
      fieldsExtracted++;
    }

    // Extract song_title
    fieldsAttempted++;
    if (!metadata.song_title) {
      const songMatch = title.match(this.songPattern);
      if (songMatch) {
        const potentialSong = songMatch[2]?.trim();
        if (potentialSong && !this.isCommonWord(potentialSong)) {
          metadata.song_title = this.cleanSongTitle(potentialSong);
          fieldsExtracted++;
        }
      }

      // Alternative: look for text before event/date for unquoted songs
      if (!metadata.song_title) {
        const altPattern = /\b\d{6}\b\s+[A-Za-z가-힣0-9\s&]+?(?:\([^)]+\))?\s+([^@]+?)\s+@/i;
        const altMatch = title.match(altPattern);
        if (altMatch && altMatch[1]) {
          let cleaned = altMatch[1].trim().replace(/[\[\]()]/g, '');
          if (
            metadata.artist_name &&
            cleaned.toLowerCase().startsWith(metadata.artist_name.toLowerCase() + ' ')
          ) {
            cleaned = cleaned.slice(metadata.artist_name.length).trim();
          }
          if (cleaned.length > 1 && !this.isCommonWord(cleaned)) {
            metadata.song_title = this.cleanSongTitle(cleaned);
            fieldsExtracted++;
          }
        }
      }
    } else {
      fieldsExtracted++;
    }

    const confidence = fieldsAttempted > 0 ? fieldsExtracted / fieldsAttempted : 0;

    return { metadata, confidence };
  }

  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'over',
      'after',
      'fancam',
      'cam',
      'video',
      'mv',
      'teaser',
      'preview',
      'highlight',
      '直캠',
      '입캠',
    ];
    return commonWords.includes(word.toLowerCase());
  }

  private normalizeName(name: string): string {
    // Capitalize first letter of each word for English names
    return name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }

  private cleanSongTitle(title: string): string {
    return title
      .replace(/[\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*[-|]\s*$/, '')
      .trim();
  }
}
