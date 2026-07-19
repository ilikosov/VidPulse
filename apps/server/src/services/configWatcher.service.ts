import { watch, type FSWatcher } from 'chokidar';

/** Minimal logger surface so this module is trivially testable with a fake. */
export interface RestartLogger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface PerformRestartDeps {
  /** Re-read + validate the config; throws (before mutating) if the new file is invalid. */
  reload: () => void;
  /** Tear down the running server + schedulers. */
  stop: () => Promise<void>;
  /** Bring the server + schedulers back up with the freshly-loaded config. */
  start: () => void;
  logger: RestartLogger;
}

/**
 * Apply a changed config by restarting the server in-process. If the new config is invalid,
 * `reload()` throws before any mutation and we keep the current server running untouched —
 * a bad edit never takes the server down.
 */
export async function performRestart({
  reload,
  stop,
  start,
  logger,
}: PerformRestartDeps): Promise<void> {
  try {
    reload();
  } catch (error) {
    logger.error('[config] change ignored — new config is invalid, keeping current:', error);
    return;
  }
  await stop();
  start();
  logger.info('[config] file changed — config reloaded, server restarted');
}

export interface ConfigWatcherDeps {
  /** Absolute path to the config file to watch. */
  path: string;
  /** Called (debounced by awaitWriteFinish) whenever the file changes. */
  onChange: () => void | Promise<void>;
  logger: RestartLogger;
}

export interface ConfigWatcher {
  start(): void;
  stop(): Promise<void>;
}

/**
 * Watch a single config file and invoke `onChange` when it is written. `awaitWriteFinish`
 * debounces editors that save in several writes; watching one file means the sibling `.bak`
 * backup does not trigger us. A restart is serialized so overlapping saves can't race.
 */
export function createConfigWatcher({ path, onChange, logger }: ConfigWatcherDeps): ConfigWatcher {
  let watcher: FSWatcher | null = null;
  let running = false;
  let pending = false;

  const handle = async () => {
    // Serialize: if a restart is already in flight, remember to run once more afterwards.
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        await onChange();
      } while (pending);
    } catch (error) {
      logger.error('[config] watcher handler failed:', error);
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (watcher) return;
      watcher = watch(path, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });
      watcher.on('change', handle);
      watcher.on('add', handle);
      watcher.on('error', (error) => logger.error('[config] watcher error:', error));
      logger.info(`[config] watching ${path} for changes`);
    },
    async stop() {
      if (!watcher) return;
      await watcher.close();
      watcher = null;
    },
  };
}
