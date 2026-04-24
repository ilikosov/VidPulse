import { ParserModule, ParsedMetadata } from './parser.types';

/**
 * Regex-based parser module for extracting metadata from K-pop video titles
 */
export class RegexModule implements ParserModule {
  // Date pattern: YYMMDD, often at the beginning, possibly in brackets
  private datePattern = /(?:^|\[|\()(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\]|\)|\s|$)/i;
  
  // Event pattern: @EVENTNAME (e.g., @MCOUNTDOWN, @MUSICCORE)
  private eventPattern = /@([A-Z0-9가 - 힣]+)/i;
  
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
    'center cam'
  ];
  
  // Common group name patterns (usually before song or in parentheses)
  private groupPattern = /(?:^|\[|\()([A-Za-z가 - 힣0-9\s&]+?)(?:\)|\]|\s+-\s+|feat\.|\s*\()\s*(?=\[|\(|@|$)/i;
  
  // Artist name pattern (often before "fancam" or in parentheses for solo cams)
  private artistPattern = /(?:^|\[|\()([A-Za-z가 - 힣]+)\s*(?:fancam|cam|직캠)/i;
  
  // Song title pattern (often after group name or before event/date)
  private songPattern = /(?:"([^"]+)"|'([^']+)')|(?:-\s*([^([\]@]+?))(?:\s*[@[(]|$))/i;

  async parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }> {
    const metadata: Partial<ParsedMetadata> = { ...currentMeta };
    let fieldsExtracted = 0;
    let fieldsAttempted = 0;

    // Extract perf_date (YYMMDD)
    fieldsAttempted++;
    if (!metadata.perf_date) {
      const dateMatch = title.match(this.datePattern);
      if (dateMatch && dateMatch[1]) {
        metadata.perf_date = dateMatch[1];
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
        metadata.event = '@' + eventMatch[1].toUpperCase();
        fieldsExtracted++;
      }
    } else {
      fieldsExtracted++;
    }

    // Extract camera_type
    fieldsAttempted++;
    if (!metadata.camera_type) {
      const lowerTitle = title.toLowerCase();
      for (const keyword of this.cameraTypeKeywords) {
        if (lowerTitle.includes(keyword.toLowerCase())) {
          metadata.camera_type = keyword;
          fieldsExtracted++;
          break;
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
        const potentialArtist = artistMatch[1].trim();
        // Avoid matching common words
        if (!this.isCommonWord(potentialArtist)) {
          metadata.artist_name = this.normalizeName(potentialArtist);
          fieldsExtracted++;
        }
      }
    } else {
      fieldsExtracted++;
    }

    // Extract group_name
    fieldsAttempted++;
    if (!metadata.group_name && !metadata.artist_name) {
      // Try to extract group name from various patterns
      const groupPatterns = [
        /\[([A-Za-z가 - 힣0-9&\s]+?)\](?=\s*[-|])/i,  // [GROUP] - Song
        /\(([A-Za-z가 - 힣0-9&\s]+?)\)(?=\s*[-|])/i,  // (GROUP) - Song
        /^([A-Za-z가 - 힣0-9&\s]+?)\s*[-|]/i,  // GROUP - Song
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
        const potentialSong = (songMatch[1] || songMatch[2] || songMatch[3])?.trim();
        if (potentialSong && !this.isCommonWord(potentialSong)) {
          metadata.song_title = this.cleanSongTitle(potentialSong);
          fieldsExtracted++;
        }
      }
      
      // Alternative: look for text between group and event/date
      if (!metadata.song_title) {
        const altPattern = /(?:\[?[A-Za-z가 - 힣]+\]?[-|]\s*)([^(@\[\]]+?)(?:@|\[|\(|$)/i;
        const altMatch = title.match(altPattern);
        if (altMatch && altMatch[1]) {
          const cleaned = altMatch[1].trim().replace(/[\[\]()]/g, '');
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
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                         'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
                         'fancam', 'cam', 'video', 'mv', 'teaser', 'preview', 'highlight',
                         '直캠', '입캠'];
    return commonWords.includes(word.toLowerCase());
  }

  private normalizeName(name: string): string {
    // Capitalize first letter of each word for English names
    return name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }

  private cleanSongTitle(title: string): string {
    return title
      .replace(/[\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*[-|]\s*$/, '')
      .trim();
  }
}
