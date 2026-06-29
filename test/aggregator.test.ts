import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  dailySummary,
  weeklyFigures,
  timeByCategory,
} from '../src/core/aggregator';
import { calendarDay, isInRange, daysInRange } from '../src/core/dates';
import {
  activityRecord,
  taskEntry,
  checkInEntry,
  isoTimestampOnDay,
} from './generators';
import { ActivityRecord, CheckInEntry, DateRange } from '../src/shared/types';

const DAY = '2024-03-15';

describe('aggregator', () => {
  // Feature: productivity-dashboard, Property 11: Daily summary aggregation
  it('Property 11: per-category time, task count, averages, and empty flag match the day', () => {
    const activityOnDay = () =>
      activityRecord().map((a) => ({ ...a, startTime: '' })).chain((a) =>
        isoTimestampOnDay(DAY).map((ts) => ({ ...a, startTime: ts }))
      );
    const checkInOnDay = () =>
      checkInEntry().chain((c) =>
        isoTimestampOnDay(DAY).map((ts) => ({ ...c, timestamp: ts }))
      );
    const taskOnDay = () =>
      taskEntry().chain((t) =>
        isoTimestampOnDay(DAY).map((ts) => ({ ...t, timestamp: ts }))
      );

    fc.assert(
      fc.property(
        fc.array(activityOnDay(), { maxLength: 10 }),
        fc.array(taskOnDay(), { maxLength: 10 }),
        fc.array(checkInOnDay(), { maxLength: 10 }),
        (activities, tasks, checkIns) => {
          const summary = dailySummary(DAY, {
            date: DAY,
            activities,
            tasks,
            checkIns,
          });

          // per-category sums
          const expected: Record<string, number> = {
            Work: 0,
            Break: 0,
            Distraction: 0,
            Uncategorized: 0,
          };
          for (const a of activities) expected[a.category] += a.durationSeconds;
          expect(summary.timeByCategory).toEqual(expected);

          expect(summary.completedTaskCount).toBe(tasks.length);

          if (checkIns.length === 0) {
            expect(summary.averageEnergy).toBeNull();
            expect(summary.averageFocus).toBeNull();
          } else {
            const e = checkIns.reduce((s, c) => s + c.energy, 0) / checkIns.length;
            expect(summary.averageEnergy).toBeCloseTo(e, 5);
          }

          const isEmpty =
            activities.length === 0 && tasks.length === 0 && checkIns.length === 0;
          expect(summary.empty).toBe(isEmpty);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 13: Weekly report range filtering — only in-range records contribute
  it('Property 13: only records within the inclusive range contribute', () => {
    const range: DateRange = { start: '2024-03-10', end: '2024-03-16' };
    fc.assert(
      fc.property(
        fc.array(activityRecord(), { maxLength: 20 }),
        (activities) => {
          const figures = weeklyFigures(range, {
            range,
            activities,
            tasks: [],
            checkIns: [],
          });
          const inRange = activities.filter((a) => isInRange(a.startTime, range));
          const expected: Record<string, number> = {
            Work: 0,
            Break: 0,
            Distraction: 0,
            Uncategorized: 0,
          };
          for (const a of inRange) expected[a.category] += a.durationSeconds;
          expect(figures.timeByCategory).toEqual(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 12: Weekly aggregation and trends
  it('Property 12: trend arrays have one per-day average entry', () => {
    const range: DateRange = { start: '2024-03-10', end: '2024-03-16' };
    fc.assert(
      fc.property(fc.array(checkInEntry(), { maxLength: 20 }), (checkIns) => {
        const figures = weeklyFigures(range, {
          range,
          activities: [],
          tasks: [],
          checkIns,
        });
        const days = daysInRange(range);
        expect(figures.energyTrend).toHaveLength(days.length);
        expect(figures.focusTrend).toHaveLength(days.length);
        days.forEach((day, i) => {
          const sameDay = checkIns.filter(
            (c) => isInRange(c.timestamp, range) && calendarDay(c.timestamp) === day
          );
          const expected =
            sameDay.length === 0
              ? 0
              : sameDay.reduce((s, c) => s + c.energy, 0) / sameDay.length;
          expect(figures.energyTrend[i]).toBeCloseTo(expected, 5);
        });
      }),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 16: Dashboard category grouping over a range
  it('Property 16: grouping equals summed in-range durations, excludes out-of-range', () => {
    const range: DateRange = { start: '2024-03-10', end: '2024-03-16' };
    fc.assert(
      fc.property(fc.array(activityRecord(), { maxLength: 25 }), (records) => {
        const grouped = timeByCategory(records, range);
        const expected: Record<string, number> = {
          Work: 0,
          Break: 0,
          Distraction: 0,
          Uncategorized: 0,
        };
        for (const r of records) {
          if (isInRange(r.startTime, range)) expected[r.category] += r.durationSeconds;
        }
        expect(grouped).toEqual(expected);
      }),
      { numRuns: 200 }
    );
  });
});
