import { describe, it, expect, vi, beforeEach } from 'vitest';

// node-cron is dynamically imported inside runScheduler(); mock it so no real timers are registered.
const { schedule, task } = vi.hoisted(() => {
  const task = { destroy: vi.fn(), stop: vi.fn() };
  return { schedule: vi.fn(() => task), task };
});
vi.mock('node-cron', () => ({ schedule }));

import { syncService } from './sync.service';

describe('SyncService scheduler lifecycle', () => {
  beforeEach(() => {
    syncService.stopScheduler();
    schedule.mockClear();
    task.destroy.mockClear();
  });

  it('registers a cron task and tears it down on stopScheduler', async () => {
    syncService.runScheduler();
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));

    syncService.stopScheduler();
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys a task that only resolves after stop was requested (async-import race)', async () => {
    syncService.runScheduler();
    syncService.stopScheduler(); // before the dynamic import resolves

    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));
    // The task created post-stop is destroyed immediately, not retained.
    await vi.waitFor(() => expect(task.destroy).toHaveBeenCalledTimes(1));
  });

  it('can be re-registered after a stop', async () => {
    syncService.runScheduler();
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));
    syncService.stopScheduler();

    syncService.runScheduler();
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(2));
  });
});
