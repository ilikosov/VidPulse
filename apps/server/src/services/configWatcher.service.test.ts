import { describe, it, expect, vi } from 'vitest';
import { performRestart } from './configWatcher.service';

const fakeLogger = () => ({ info: vi.fn(), error: vi.fn() });

describe('performRestart', () => {
  it('reloads, stops, then starts (in order) on a valid config', async () => {
    const calls: string[] = [];
    const reload = vi.fn(() => void calls.push('reload'));
    const stop = vi.fn(async () => void calls.push('stop'));
    const start = vi.fn(() => void calls.push('start'));
    const logger = fakeLogger();

    await performRestart({ reload, stop, start, logger });

    expect(calls).toEqual(['reload', 'stop', 'start']);
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps the current server (no stop/start) when reload throws on an invalid config', async () => {
    const reload = vi.fn(() => {
      throw new Error('Invalid VidPulse configuration');
    });
    const stop = vi.fn(async () => {});
    const start = vi.fn(() => {});
    const logger = fakeLogger();

    await performRestart({ reload, stop, start, logger });

    expect(stop).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
