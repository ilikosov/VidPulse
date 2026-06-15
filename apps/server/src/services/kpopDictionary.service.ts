import { buildKpopLibrary } from '@vidpulse/kpop-sources';
import { config } from '../config';
import { logger } from '../lib/logger';
import { logEvent } from './eventLog.service';
import { mediaLibraryService, settingsService } from './dictionary';
import { validateMediaLibraryPayload } from './mediaLibrarySchema.service';
import type { MediaLibraryImportSummary } from './dictionary/media-library.service';
import { AppError } from '../middleware/AppError';

export const LAST_REFRESHED_SETTING = 'kpop_dict_last_refreshed';
export const LAST_SUMMARY_SETTING = 'kpop_dict_last_summary';
/** Resume cursor for chunked MusicBrainz enrichment (index into the mbid-bearing group list). */
export const MB_CURSOR_SETTING = 'kpop_dict_mb_cursor';

export class KpopDictionaryService {
  /**
   * Fetch the current K-pop catalogue from external sources and import it into the
   * dictionary. Defaults to a non-destructive `merge`; `replace` is gated behind the
   * dangerous-actions flag (same rule as the manual media-library import route).
   */
  async refresh(options?: { mode?: 'merge' | 'replace' }): Promise<MediaLibraryImportSummary> {
    const mode = options?.mode ?? 'merge';
    if (mode === 'replace' && !config.dangerousActionsEnabled) {
      throw new AppError(403, 'Dangerous media library actions are disabled', 'FORBIDDEN');
    }

    const startedAt = Date.now();

    // Chunked MusicBrainz enrichment "по частям": start this run from the persisted cursor and
    // capture the processed window so we can advance (and wrap) it after a successful import.
    // `replace` re-imports the whole catalogue, so restart enrichment from the top.
    const mbCursor =
      mode === 'replace' ? 0 : Number(await settingsService.getSetting(MB_CURSOR_SETTING)) || 0;
    let mbProgress: { total: number; processedTo: number } | undefined;

    const snapshot = await buildKpopLibrary({
      userAgent: config.kpopDictionary.userAgent,
      limit: config.kpopDictionary.limit,
      timeoutMs: config.kpopDictionary.timeoutMs,
      logger,
      musicBrainz: config.musicBrainz.enabled
        ? {
            enabled: true,
            userAgent: config.musicBrainz.userAgent,
            rateLimitMs: config.musicBrainz.rateLimitMs,
            limit: config.musicBrainz.limit,
            offset: mbCursor,
            maxRecordings: config.musicBrainz.maxRecordings,
            onProgress: (info) => {
              mbProgress = info;
            },
          }
        : undefined,
    });
    snapshot.mode = mode;

    const validation = validateMediaLibraryPayload(snapshot);
    if (!validation.valid) {
      throw new AppError(
        502,
        `K-pop source produced an invalid snapshot: ${validation.errors.slice(0, 5).join('; ')}`,
        'BAD_GATEWAY',
      );
    }

    const summary = await mediaLibraryService.importMediaLibrary(snapshot);

    const durationMs = Date.now() - startedAt;
    await logEvent(
      'kpop_dictionary_refreshed',
      `K-pop dictionary refreshed (${mode}): ${snapshot.groups.length} group(s) from source.`,
      { mode, durationMs, summary },
    );
    await settingsService.upsertSetting(LAST_REFRESHED_SETTING, new Date().toISOString());
    await settingsService.upsertSetting(LAST_SUMMARY_SETTING, JSON.stringify(summary));

    // Advance the chunked-enrichment cursor; wrap to the start once we've covered every group so
    // the next refresh begins a fresh cycle (and re-attempts any connect-timeout stragglers).
    if (mbProgress) {
      const next = mbProgress.processedTo >= mbProgress.total ? 0 : mbProgress.processedTo;
      await settingsService.upsertSetting(MB_CURSOR_SETTING, String(next));
    }

    return summary;
  }

  /** Register the scheduled refresh — only when explicitly enabled (opt-in). */
  runScheduler(): void {
    if (!config.kpopDictionary.enabled) {
      logger.info(
        'K-pop dictionary refresh scheduler disabled (set KPOP_DICT_REFRESH_ENABLED=true)',
      );
      return;
    }
    const cronTime = config.kpopDictionary.cronTime;
    import('node-cron')
      .then((cron) => {
        cron.schedule(cronTime, async () => {
          try {
            await this.refresh();
          } catch (error) {
            logger.error('Scheduled K-pop dictionary refresh failed:', error);
          }
        });
        logger.info(`K-pop dictionary refresh scheduler started with cron pattern: ${cronTime}`);
      })
      .catch((error) => logger.error('Failed to start K-pop dictionary scheduler:', error));
  }
}

export const kpopDictionaryService = new KpopDictionaryService();
