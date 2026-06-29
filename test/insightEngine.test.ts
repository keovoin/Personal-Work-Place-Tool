import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generate, INSUFFICIENT_DATA_STATEMENT } from '../src/core/insightEngine';
import { activityRecord, taskEntry, checkInEntry } from './generators';
import { PeriodData, DateRange } from '../src/shared/types';

const range: DateRange = { start: '2024-03-10', end: '2024-03-16' };

describe('insightEngine', () => {
  // Feature: productivity-dashboard, Property 14: At least one insight always produced (even empty period)
  it('Property 14: always returns at least one insight', () => {
    fc.assert(
      fc.property(
        fc.array(activityRecord(), { maxLength: 15 }),
        fc.array(taskEntry(), { maxLength: 15 }),
        fc.array(checkInEntry(), { maxLength: 15 }),
        (activities, tasks, checkIns) => {
          const period: PeriodData = { range, activities, tasks, checkIns };
          const insights = generate(period);
          expect(insights.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 14: empty period still yields an insight', () => {
    const insights = generate({ range, activities: [], tasks: [], checkIns: [] });
    expect(insights.length).toBeGreaterThanOrEqual(1);
  });

  // Feature: productivity-dashboard, Property 15: Insufficient-data statement when fewer than two distinct data-days
  it('Property 15: includes insufficient-data statement for < 2 data-days', () => {
    // All records on a single in-range day -> 1 distinct data-day.
    const oneDay = '2024-03-12T08:00:00.000Z';
    fc.assert(
      fc.property(
        fc.array(activityRecord(), { maxLength: 10 }),
        (activities) => {
          const onOneDay = activities.map((a) => ({ ...a, startTime: oneDay }));
          const insights = generate({
            range,
            activities: onOneDay,
            tasks: [],
            checkIns: [],
          });
          expect(insights).toContain(INSUFFICIENT_DATA_STATEMENT);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 15: two or more data-days omits the insufficient-data statement', () => {
    const insights = generate({
      range,
      activities: [
        { id: '1', appName: 'A', windowTitle: '', startTime: '2024-03-11T09:00:00.000Z', durationSeconds: 60, category: 'Work', isIdle: false },
        { id: '2', appName: 'B', windowTitle: '', startTime: '2024-03-13T09:00:00.000Z', durationSeconds: 60, category: 'Work', isIdle: false },
      ],
      tasks: [],
      checkIns: [],
    });
    expect(insights).not.toContain(INSUFFICIENT_DATA_STATEMENT);
  });
});
