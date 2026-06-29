import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SqliteRepository, SqlDatabase } from '../src/data/repository';
import {
  activityRecord,
  taskEntry,
  checkInEntry,
} from './generators';
import {
  ActivityRecord,
  CheckInEntry,
  DateRange,
  TaskEntry,
} from '../src/shared/types';

const FULL: DateRange = { start: '0000-01-01', end: '9999-12-31' };
const tmpFiles: string[] = [];

function tmpDbPath(): string {
  const p = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'pwt-')),
    'store.sqlite'
  );
  tmpFiles.push(p);
  return p;
}

afterEach(() => {
  while (tmpFiles.length) {
    const p = tmpFiles.pop()!;
    try {
      fs.rmSync(path.dirname(p), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

const byId = <T extends { id: string }>(arr: T[]) =>
  [...arr].sort((a, b) => a.id.localeCompare(b.id));

describe('SqliteRepository', () => {
  // Feature: productivity-dashboard, Property 20: Delete-all clears the store
  it('Property 20: deleteAll empties every query', () => {
    fc.assert(
      fc.property(
        fc.array(activityRecord(), { maxLength: 8 }),
        fc.array(taskEntry(), { maxLength: 8 }),
        fc.array(checkInEntry(), { maxLength: 8 }),
        (activities, tasks, checkIns) => {
          const repo = new SqliteRepository({ filePath: ':memory:' });
          repo.init();
          activities.forEach((a) => repo.saveActivity(a));
          tasks.forEach((t) => repo.saveTask(t));
          checkIns.forEach((c) => repo.saveCheckIn(c));
          repo.deleteAll();
          expect(repo.queryActivities(FULL)).toEqual([]);
          expect(repo.queryTasks(FULL)).toEqual([]);
          expect(repo.queryCheckIns(FULL)).toEqual([]);
          repo.close();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: productivity-dashboard, Property 21: Persistence round-trip across restart
  it('Property 21: persisting and reloading returns equal data', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(activityRecord(), { selector: (a) => a.id, maxLength: 6 }),
        fc.uniqueArray(taskEntry(), { selector: (t) => t.id, maxLength: 6 }),
        fc.uniqueArray(checkInEntry(), { selector: (c) => c.id, maxLength: 6 }),
        (activities, tasks, checkIns) => {
          const dbPath = tmpDbPath();
          const repo1 = new SqliteRepository({ filePath: dbPath });
          repo1.init();
          activities.forEach((a) => repo1.saveActivity(a));
          tasks.forEach((t) => repo1.saveTask(t));
          checkIns.forEach((c) => repo1.saveCheckIn(c));
          repo1.close();

          const repo2 = new SqliteRepository({ filePath: dbPath });
          const result = repo2.init();
          expect(result).toBe('loaded');
          expect(byId(repo2.queryActivities(FULL))).toEqual(byId(activities));
          expect(byId(repo2.queryTasks(FULL))).toEqual(byId(tasks));
          expect(byId(repo2.queryCheckIns(FULL))).toEqual(byId(checkIns));
          repo2.close();
        }
      ),
      { numRuns: 30 }
    );
  });

  // Feature: productivity-dashboard, Property 17: Date-range filtering is a deterministic function of the range
  it('Property 17: range queries return exactly the in-range records', () => {
    const tasks: TaskEntry[] = [
      { id: 't1', description: 'a', timestamp: '2024-03-01T10:00:00.000Z' },
      { id: 't2', description: 'b', timestamp: '2024-03-10T10:00:00.000Z' },
      { id: 't3', description: 'c', timestamp: '2024-03-20T10:00:00.000Z' },
    ];
    const repo = new SqliteRepository({ filePath: ':memory:' });
    repo.init();
    tasks.forEach((t) => repo.saveTask(t));

    const r1: DateRange = { start: '2024-03-05', end: '2024-03-15' };
    expect(repo.queryTasks(r1).map((t) => t.id)).toEqual(['t2']);

    const r2: DateRange = { start: '2024-03-01', end: '2024-03-20' };
    expect(repo.queryTasks(r2).map((t) => t.id)).toEqual(['t1', 't2', 't3']);

    // querying again with r1 returns the same r1-only result (determinism)
    expect(repo.queryTasks(r1).map((t) => t.id)).toEqual(['t2']);
    repo.close();
  });

  // Requirement 11.2: missing file is created
  it('Requirement 11.2: missing store file yields "created"', () => {
    const dbPath = tmpDbPath();
    const repo = new SqliteRepository({ filePath: dbPath });
    expect(repo.init()).toBe('created');
    expect(fs.existsSync(dbPath)).toBe(true);
    repo.close();
  });

  it('existing store yields "loaded" on next init', () => {
    const dbPath = tmpDbPath();
    const r1 = new SqliteRepository({ filePath: dbPath });
    r1.init();
    r1.close();
    const r2 = new SqliteRepository({ filePath: dbPath });
    expect(r2.init()).toBe('loaded');
    r2.close();
  });

  // Requirement 11.3: corrupted file is backed up and recreated
  it('Requirement 11.3: corrupted store is recovered (backup + recreate)', () => {
    const dbPath = tmpDbPath();
    fs.writeFileSync(dbPath, 'this is not a valid sqlite database file');
    const repo = new SqliteRepository({ filePath: dbPath });
    expect(repo.init()).toBe('recovered');
    // A backup file should now exist alongside the recreated store.
    const dir = path.dirname(dbPath);
    const backups = fs.readdirSync(dir).filter((f) => f.includes('.corrupt-'));
    expect(backups.length).toBeGreaterThanOrEqual(1);
    repo.close();
  });

  // Requirement 11.4: uncreatable store falls back to memory-only
  it('Requirement 11.4: creation failure yields "no-persistence"', () => {
    const failingFactory = (p: string): SqlDatabase => {
      if (p === ':memory:') {
        const real = new SqliteRepository({ filePath: ':memory:' });
        // build a memory db directly via better-sqlite3
        const Database = require('better-sqlite3');
        return new Database(':memory:') as unknown as SqlDatabase;
      }
      throw new Error('disk unavailable');
    };
    const repo = new SqliteRepository({
      filePath: '/definitely/not/writable/store.sqlite',
      databaseFactory: failingFactory,
      fs: {
        existsSync: () => false,
        renameSync: () => undefined,
        writeFileSync: () => undefined,
      },
    });
    expect(repo.init()).toBe('no-persistence');
    expect(repo.isPersistent()).toBe(false);
    repo.close();
  });
});
