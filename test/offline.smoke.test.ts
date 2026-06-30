import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SqliteRepository } from '../src/data/repository';
import { TimeTrackerService } from '../src/main/timeTrackerService';
import { InMemoryTaskLogger } from '../src/core/taskLogger';
import { DefaultCheckInScheduler } from '../src/core/checkInScheduler';
import { dailySummary } from '../src/core/aggregator';
import { buildWeeklyReport, dayDataFor } from '../src/core/reports';
import { trailingWeek } from '../src/core/dates';
import { ActiveWindow, DateRange, PeriodData } from '../src/shared/types';

const SRC_DIRS = ['src/core', 'src/data', 'src/main'];
const NETWORK_PATTERNS = [
  /require\(['"]https?['"]\)/,
  /from ['"]https?['"]/,
  /require\(['"]net['"]\)/,
  /\baxios\b/,
  /\bnode-fetch\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
];

function listTsFiles(dir: string): string[] {
  const abs = path.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(abs, f));
}

describe('offline / local-only guarantees', () => {
  // Requirements 6.5, 9.1, 9.4, 10.1-10.4: no network client is wired in
  it('does not import or use any network client in core/data/main', () => {
    const files = SRC_DIRS.flatMap(listTsFiles);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of NETWORK_PATTERNS) {
        expect(pattern.test(content), `${file} should not use network (${pattern})`).toBe(false);
      }
    }
  });

  // Core flows succeed entirely offline / on-device
  it('runs track -> log -> check-in -> daily summary -> weekly report offline', async () => {
    const repo = new SqliteRepository({ filePath: ':memory:' });
    expect(repo.init()).toBe('created');

    // 1. Track time
    let win: ActiveWindow = { appName: 'Editor', windowTitle: 'a.ts' };
    let t = Date.UTC(2024, 2, 15, 9, 0, 0);
    const service = new TimeTrackerService(
      repo,
      { getActiveWindow: async () => win, getIdleSeconds: () => 0, now: () => new Date(t) },
      300,
      5
    );
    service.setEnabled(true);
    await service.tick();
    t += 60_000;
    win = { appName: 'Browser', windowTitle: 'docs' };
    await service.tick();

    // 2. Log a task
    const logger = new InMemoryTaskLogger({ onSave: (task) => repo.saveTask(task) });
    expect(logger.add('Shipped feature', new Date(t)).ok).toBe(true);

    // 3. Submit a check-in
    const checkIn = new DefaultCheckInScheduler().onSubmit(4, 5, new Date(t));
    repo.saveCheckIn(checkIn);

    // 4. Daily summary
    const day = '2024-03-15';
    const dayRange: DateRange = { start: day, end: day };
    const dayPeriod: PeriodData = {
      range: dayRange,
      activities: repo.queryActivities(dayRange),
      tasks: repo.queryTasks(dayRange),
      checkIns: repo.queryCheckIns(dayRange),
    };
    const summary = dailySummary(day, dayDataFor(day, dayPeriod));
    expect(summary.empty).toBe(false);
    expect(summary.completedTaskCount).toBe(1);

    // 5. Weekly report
    const weekRange = trailingWeek(day);
    const weekPeriod: PeriodData = {
      range: weekRange,
      activities: repo.queryActivities(weekRange),
      tasks: repo.queryTasks(weekRange),
      checkIns: repo.queryCheckIns(weekRange),
    };
    const report = buildWeeklyReport(weekRange, weekPeriod);
    expect(report.insights.length).toBeGreaterThanOrEqual(1);
    repo.close();
  });
});
