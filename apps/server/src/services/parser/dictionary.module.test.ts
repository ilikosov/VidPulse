import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DictionaryModule } from './dictionary.module';
import { dictionaryService } from '../dictionary.service';

vi.mock('../dictionary.service', () => ({
  dictionaryService: {
    getAllGroups: vi.fn(),
    getAllArtists: vi.fn(),
    getAllSongs: vi.fn(),
    getAllEvents: vi.fn(),
    getAllAliases: vi.fn(),
    resolveAlias: vi.fn(),
  },
}));

describe('DictionaryModule aliases normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(dictionaryService.getAllGroups).mockResolvedValue([
      { id: 1, name: 'LE SSERAFIM' },
      { id: 2, name: 'ITZY' },
    ]);
    vi.mocked(dictionaryService.getAllArtists).mockResolvedValue([
      { name: 'YUNJIN', group_name: 'LE SSERAFIM' },
      { name: 'YUNA', group_name: 'ITZY' },
    ] as any);
    vi.mocked(dictionaryService.getAllSongs).mockResolvedValue([{ title: 'DALLA DALLA' }] as any);
    vi.mocked(dictionaryService.getAllEvents).mockResolvedValue([{ name: 'INKIGAYO' }] as any);
    vi.mocked(dictionaryService.getAllAliases).mockResolvedValue([
      { entity_type: 'group', alias: '르세라핌' },
      { entity_type: 'group', alias: '있지' },
      { entity_type: 'artist', alias: '허윤진' },
      { entity_type: 'artist', alias: '유나' },
      { entity_type: 'song', alias: '달라달라' },
      { entity_type: 'song', alias: '유나' },
      { entity_type: 'event', alias: '인기가요' },
    ] as any);
    vi.mocked(dictionaryService.resolveAlias).mockImplementation(
      async (entityType: any, alias: any) => {
        const key = `${entityType}:${alias}`;
        const map: Record<string, { id: number; name: string }> = {
          'group:르세라핌': { id: 1, name: 'LE SSERAFIM' },
          'group:있지': { id: 2, name: 'ITZY' },
          'artist:허윤진': { id: 3, name: 'YUNJIN' },
          'artist:유나': { id: 4, name: 'YUNA' },
          'song:달라달라': { id: 5, name: 'DALLA DALLA' },
          'song:유나': { id: 6, name: 'YUNA SONG' },
          'event:인기가요': { id: 7, name: 'INKIGAYO' },
        };
        return map[key] ?? null;
      },
    );
  });

  it('normalizes korean group and artist aliases from metadata fields', async () => {
    const module = new DictionaryModule();
    const result = await module.parse("르세라핌 허윤진 직캠 '1-800-hot-n-fun'", {
      group_name: '르세라핌',
      artist_name: '허윤진',
    });

    expect(result.metadata.group_name).toBe('LE SSERAFIM');
    expect(result.metadata.artist_name).toBe('YUNJIN');
  });

  it('normalizes 있지/유나 aliases to canonical names', async () => {
    const module = new DictionaryModule();
    const result = await module.parse("있지 유나 직캠 'DALLA DALLA'", {
      group_name: '있지',
      artist_name: '유나',
      song_title: '달라달라',
    });

    expect(result.metadata.group_name).toBe('ITZY');
    expect(result.metadata.artist_name).toBe('YUNA');
    expect(result.metadata.song_title).toBe('DALLA DALLA');
  });

  it('keeps aliases separated by entity type to avoid conflicts', async () => {
    const module = new DictionaryModule();
    const result = await module.parse('유나 stage', {
      artist_name: '유나',
      song_title: '유나',
    });

    expect(result.metadata.artist_name).toBe('YUNA');
    expect(result.metadata.song_title).toBe('YUNA SONG');
  });

  it('resolves event alias via dictionary aliases', async () => {
    const module = new DictionaryModule();
    const result = await module.parse('무대 @인기가요', {
      event: '@인기가요',
    });

    expect(result.metadata.event).toBe('@INKIGAYO');
  });
});
