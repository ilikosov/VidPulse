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

  it('extracts group/artist from "GROUP(한글) ARTIST \'song\'" credit', async () => {
    const module = new RegexModule();
    const title = "(4K) [NPOP CAM] MEOVV(미야오) GAWON 'TOXIC' Ι NPOP LIMITED EDITION - SIDE A";

    const result = await module.parse(title, {});

    expect(result.metadata.group_name).toBe('MEOVV');
    expect(result.metadata.artist_name).toBe('GAWON');
    expect(result.metadata.song_title).toBe('TOXIC');
  });

  it('extracts group/artist/song from "GROUP ARTIST - SONG (한글 mirror)" credit', async () => {
    const module = new RegexModule();
    const title =
      '[주간아 직캠] MEOVV GAWON - HANDS UP (미야오 가원 - 핸즈 업) l #주간아이돌 l EP.696';

    const result = await module.parse(title, {});

    expect(result.metadata.group_name).toBe('MEOVV');
    expect(result.metadata.artist_name).toBe('GAWON');
    expect(result.metadata.song_title).toBe('HANDS UP');
  });

  it('extracts a song wrapped in mismatched straight/curly quotes', async () => {
    const module = new RegexModule();
    const title =
      "[K-Fancam] 빌리 문수아 직캠 'GingaMingaYo’ (Billlie Moon Sua Fancam) l @MusicBank 220311";

    const result = await module.parse(title, {});

    expect(result.metadata.song_title).toBe('GingaMingaYo');
    expect(result.metadata.event).toBe('@MUSICBANK');
    expect(result.metadata.perf_date).toBe('220311');
  });

  it('parses "credit (한글) – song cam | show | broadcasterYYMMDD" segmented titles', async () => {
    const module = new RegexModule();
    const title =
      '[#음중직캠] MEOVV GAWON (미야오 가원) – HANDS UP FanCam | 쇼! 음악중심 | MBC250503';

    const result = await module.parse(title, {});

    expect(result.metadata.group_name).toBe('MEOVV');
    expect(result.metadata.artist_name).toBe('GAWON');
    expect(result.metadata.song_title).toBe('HANDS UP');
    expect(result.metadata.event).toBe('@음악중심'); // show segment, "쇼!" prefix stripped
    expect(result.metadata.perf_date).toBe('250503'); // from the "MBC250503" segment
  });

  it('strips an 8-digit YYYYMMDD date from the event and reads it into perf_date', async () => {
    const module = new RegexModule();
    const title =
      "[안방1열 직캠4K] 빌리 문수아 'GingaMingaYo(the strange world)' (Billlie Moon Sua FanCam)│@SBSInkigayo_20220313";

    const result = await module.parse(title, {});

    expect(result.metadata.song_title).toBe('GingaMingaYo(the strange world)');
    expect(result.metadata.event).toBe('@SBSINKIGAYO'); // date stripped (dictionary normalizes spacing)
    expect(result.metadata.perf_date).toBe('220313');
  });

  it('drops a trailing "EP.<n>" segment so the show is the event, not the song', async () => {
    const module = new RegexModule();
    const title =
      '[쇼챔직캠 4K] Billlie MOON SUA - snowy night (빌리 문수아 - 스노이 나이트) | Show Champion | EP.420';

    const result = await module.parse(title, {});

    expect(result.metadata.song_title).toBe('snowy night');
    expect(result.metadata.event).toBe('@SHOW CHAMPION');
  });

  it('drops a "broadcaster+date+방송" trailing segment (MBC220903방송)', async () => {
    const module = new RegexModule();
    const title =
      '[예능연구소] Billlie MOONSUA - RING ma Bell(빌리 문수아 - 링 마 벨) FanCam | Show! MusicCore | MBC220903방송';

    const result = await module.parse(title, {});

    expect(result.metadata.song_title).toBe('RING ma Bell');
    expect(result.metadata.event).toBe('@SHOW! MUSICCORE');
    expect(result.metadata.perf_date).toBe('220903');
  });

  it.each([
    '250829-31 에스파 카리나 GOOD STUFF @ aespa LIVE TOUR -SYNK : aeXIS LINE- in SEOUL (4K FANCAM MULTI CAM)',
    '250829 에스파 카리나 GOOD STUFF @ aespa LIVE TOUR -SYNK : aeXIS LINE- in SEOUL (4K FANCAM)',
    '250829~31 에스파 카리나 GOOD STUFF @ aespa LIVE TOUR -SYNK : aeXIS LINE- in SEOUL (4K FANCAM)',
    '250829-250831 에스파 카리나 GOOD STUFF @ aespa LIVE TOUR -SYNK : aeXIS LINE- in SEOUL (4K FANCAM)',
  ])('parses date/date-range prefix correctly: %s', async (title) => {
    const module = new RegexModule();
    const result = await module.parse(title, {});

    expect(result.metadata.perf_date).toBe('250829');
    expect(result.metadata.group_name).toBe('에스파');
    expect(result.metadata.artist_name).toBe('카리나');
    expect(result.metadata.song_title).toBe('GOOD STUFF');
    expect(result.metadata.event).toBe('@AESPA LIVE TOUR -SYNK : AEXIS LINE- IN SEOUL');
    expect(result.metadata.camera_type).toContain('FanCam');
    expect(result.metadata.is_fancam).toBe(true);
  });

  describe('dotted dates (MPD style)', () => {
    it('extracts "YYYY.M.D" after an event suffix, normalized to YYMMDD', async () => {
      const module = new RegexModule();
      const title =
        "[MPD직캠] 빌리 츠키 직캠 4K 'ZAP' (Billlie TSUKI FanCam) | @MCOUNTDOWN_2026.5.14";

      const result = await module.parse(title, {});

      expect(result.metadata.perf_date).toBe('260514');
    });

    it('extracts a two-digit-year dotted date', async () => {
      const module = new RegexModule();
      const result = await module.parse("그룹 멤버 직캠 'Song' @SHOW_26.5.14", {});

      expect(result.metadata.perf_date).toBe('260514');
    });

    it('prefers a YYMMDD date over a dotted one', async () => {
      const module = new RegexModule();
      const result = await module.parse("260101 그룹 멤버 'Song' @SHOW_2026.5.14", {});

      expect(result.metadata.perf_date).toBe('260101');
    });

    it('ignores dotted numbers with an invalid month', async () => {
      const module = new RegexModule();
      const result = await module.parse("그룹 멤버 'Song' @SHOW_2026.13.5", {});

      expect(result.metadata.perf_date).toBeUndefined();
    });
  });
});
