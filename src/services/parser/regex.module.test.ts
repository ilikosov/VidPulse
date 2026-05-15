import { describe, expect, it } from 'vitest';
import { RegexModule } from './regex.module';

describe('RegexModule', () => {
  it('parses bare song before event for YYMMDD KoreanGroup KoreanArtist Song @ Event (Camera)', async () => {
    const module = new RegexModule();
    const title =
      '250727 에스파 카리나 Dark Arts @ PUBG NATIONS CUP 2025 - FINAL STAGE (4K FANCAM)';

    const result = await module.parse(title, {});

    expect(result.metadata.perf_date).toBe('250727');
    expect(['에스파', 'AESPA']).toContain(result.metadata.group_name);
    expect(['카리나', 'KARINA']).toContain(result.metadata.artist_name);
    expect(result.metadata.song_title).toBe('Dark Arts');
    expect(result.metadata.event).toBe('@PUBG NATIONS CUP 2025 - FINAL STAGE');
    expect(result.metadata.camera_type).toContain('4K');
    expect(result.metadata.is_fancam).toBe(true);
  });
});
