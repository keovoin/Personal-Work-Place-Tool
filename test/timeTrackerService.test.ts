import { describe, it, expect } from 'vitest';
import { TimeTrackerService } from '../src/main/timeTrackerService';
import { SqliteRepository } from '../src/data/repository';
import { ActiveWindow } from '../src/shared/types';

function makeRepo() {
  const repo = new SqliteRepository({ filePath: ':memory:' });
  repo.init();
  return repo;
}

describe('TimeTrackerService (integration of pure poll + persistence)', () => {
  // Requirement 1.1, 1.5: polling persists completed records on window change
  it('persists a completed record when the active window changes', async () => {
    const repo = makeRepo();
    let win: ActiveWindow = { appName: 'Editor', windowTitle: 'a.ts' };
    let t = Date.UTC(2024, 0, 1, 9, 0, 0);
    const service = new TimeTrackerService(
      repo,
      {
        getActiveWindow: async () => win,
        getIdleSeconds: () => 0,
        now: () => new Date(t),
      },
      300,
      5
    );
    service.setEnabled(true);

    await service.tick(); // establish Editor
    t += 30_000;
    win = { appName: 'Browser', windowTitle: 'news' };
    await service.tick(); // window change -> Editor record finalized

    const records = repo.queryActivities({ start: '2024-01-01', end: '2024-01-01' });
    expect(records.length).toBe(1);
    expect(records[0].appName).toBe('Editor');
    repo.close();
  });

  // Requirement 8.3, 8.4: disabled tracking produces no records
  it('produces no records while tracking is disabled', async () => {
    const repo = makeRepo();
    let t = Date.UTC(2024, 0, 1, 9, 0, 0);
    let win: ActiveWindow = { appName: 'A', windowTitle: 'x' };
    const service = new TimeTrackerService(
      repo,
      {
        getActiveWindow: async () => win,
        getIdleSeconds: () => 0,
        now: () => new Date(t),
      },
      300,
      5
    );
    service.setEnabled(false);
    await service.tick();
    t += 30_000;
    win = { appName: 'B', windowTitle: 'y' };
    await service.tick();
    expect(repo.queryActivities({ start: '2024-01-01', end: '2024-01-01' })).toEqual([]);
    repo.close();
  });

  it('applies category rules to persisted records', async () => {
    const repo = makeRepo();
    repo.setCategoryRule({ appName: 'Editor', category: 'Work' });
    let win: ActiveWindow = { appName: 'Editor', windowTitle: 'a.ts' };
    let t = Date.UTC(2024, 0, 1, 9, 0, 0);
    const service = new TimeTrackerService(
      repo,
      { getActiveWindow: async () => win, getIdleSeconds: () => 0, now: () => new Date(t) },
      300,
      5
    );
    service.refreshRules();
    service.setEnabled(true);
    await service.tick();
    t += 10_000;
    win = { appName: 'Other', windowTitle: 'z' };
    await service.tick();
    const records = repo.queryActivities({ start: '2024-01-01', end: '2024-01-01' });
    expect(records[0].category).toBe('Work');
    repo.close();
  });
});
