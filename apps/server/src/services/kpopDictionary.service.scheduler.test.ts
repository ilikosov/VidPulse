import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { config } from '../config';

// node-cron is dynamically imported inside runScheduler(); mock it so no real timers are registered.
const { schedule, task } = vi.hoisted(() => {
  const task = { destroy: vi.fn(), stop: vi.fn() };
  return { schedule: vi.fn(() => task), task };
});
vi.mock('node-cron', () => ({ schedule }));

// The source builder is unused here (we never call refresh), but stub it to avoid any real import cost.
vi.mock('@vidpulse/kpop-sources', () => ({ buildKpopLibrary: vi.fn() }));

import { kpopDictionaryService } from './kpopDictionary.service';

describe('KpopDictionaryService scheduler lifecycle', () => {
  const originalEnabled = config.kpopDictionary.enabled;

  beforeEach(() => {
    kpopDictionaryService.stopScheduler();
    schedule.mockClear();
    task.destroy.mockClear();
  });
  afterEach(() => {
    config.kpopDictionary.enabled = originalEnabled;
  });

  it('does not schedule when the dictionary refresh is disabled', async () => {
    config.kpopDictionary.enabled = false;
    kpopDictionaryService.runScheduler();
    // Give the (skipped) dynamic import a tick — nothing should be scheduled.
    await new Promise((r) => setTimeout(r, 10));
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules when enabled and tears down on stopScheduler', async () => {
    config.kpopDictionary.enabled = true;
    kpopDictionaryService.runScheduler();
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));

    kpopDictionaryService.stopScheduler();
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });
});
