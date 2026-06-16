import { buildKpopLibrary } from '@vidpulse/kpop-sources';
import { knex, dictionaryGroupRepository } from '@vidpulse/db';
import { config } from '../config';
import { logger } from '../lib/logger';
import { logEvent } from './eventLog.service';
import { groupService, mediaLibraryService, settingsService } from './dictionary';
import { normalizeName } from './dictionary/utils';
import { validateMediaLibraryPayload } from './mediaLibrarySchema.service';
import type { MediaLibraryImportSummary } from './dictionary/media-library.service';
import { AppError } from '../middleware/AppError';

export const LAST_REFRESHED_SETTING = 'kpop_dict_last_refreshed';
export const LAST_SUMMARY_SETTING = 'kpop_dict_last_summary';

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

    // Chunked MusicBrainz enrichment "по частям": prioritise the stalest groups (oldest/never
    // `songs_enriched_at` first) so each run enriches a chunk and connect-timeout stragglers —
    // left un-stamped — come back to the front next run. The DB is the single source of progress.
    const enrichedAt = new Map<string, number>();
    if (config.musicBrainz.enabled) {
      for (const g of await dictionaryGroupRepository.getAll()) {
        enrichedAt.set(
          normalizeName(g.name),
          g.songs_enriched_at ? Date.parse(g.songs_enriched_at) : 0,
        );
      }
    }
    let mbProcessed: string[] | undefined;

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
            maxRecordings: config.musicBrainz.maxRecordings,
            priority: (group) => enrichedAt.get(normalizeName(group.name)) ?? 0,
            onProgress: (info) => {
              mbProcessed = info.processed;
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

    // Stamp the groups we enriched this run so the next refresh skips them until they're the
    // stalest again; failed groups stay un-stamped and get retried first next time.
    if (mbProcessed?.length) {
      const now = new Date().toISOString();
      for (const name of mbProcessed) {
        const group = await groupService.findGroupByNameOrAlias(knex, name);
        if (group) await dictionaryGroupRepository.update(group.id, { songs_enriched_at: now });
      }
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
