/**
 * Aggregator (Requirements 5, 6, 7).
 *
 * Pure functions that build the Daily_Summary, Weekly_Report figures, and
 * dashboard date-range groupings from raw records. All range filtering is
 * inclusive by calendar day and deterministic in the requested range.
 */

import { Aggregator } from '../shared/interfaces';
import {
  ActivityRecord,
  Category,
  CATEGORIES,
  CheckInEntry,
  DailySummary,
  DateRange,
  DayData,
  PeriodData,
  WeeklyFigures,
} from '../shared/types';
import { calendarDay, daysInRange, isInRange } from './dates';

/** A category map initialized to zero for every category. */
export function zeroCategoryMap(): Record<Category, number> {
  const map = {} as Record<Category, number>;
  for (const c of CATEGORIES) map[c] = 0;
  return map;
}

/** Sums activity durations per category. */
function sumByCategory(records: ActivityRecord[]): Record<Category, number> {
  const map = zeroCategoryMap();
  for (const r of records) {
    map[r.category] = (map[r.category] ?? 0) + r.durationSeconds;
  }
  return map;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Daily summary aggregation (Requirements 5.2, 5.4 / Property 11). */
export function dailySummary(date: string, data: DayData): DailySummary {
  const timeByCategory = sumByCategory(data.activities);
  const energies = data.checkIns.map((c) => c.energy);
  const focuses = data.checkIns.map((c) => c.focus);
  const empty =
    data.activities.length === 0 &&
    data.tasks.length === 0 &&
    data.checkIns.length === 0;

  return {
    date,
    timeByCategory,
    completedTaskCount: data.tasks.length,
    averageEnergy: mean(energies),
    averageFocus: mean(focuses),
    empty,
  };
}

/** Average rating for a single day, or 0 when no check-ins exist that day. */
function dayAverage(
  checkIns: CheckInEntry[],
  day: string,
  pick: (c: CheckInEntry) => number
): number {
  const sameDay = checkIns.filter((c) => calendarDay(c.timestamp) === day);
  if (sameDay.length === 0) return 0;
  return sameDay.reduce((acc, c) => acc + pick(c), 0) / sameDay.length;
}

/**
 * Weekly figures with inclusive range filtering and per-day trend arrays
 * (Requirements 6.1, 6.2 / Properties 12, 13).
 */
export function weeklyFigures(
  range: DateRange,
  data: PeriodData
): WeeklyFigures {
  const activities = data.activities.filter((r) =>
    isInRange(r.startTime, range)
  );
  const tasks = data.tasks.filter((t) => isInRange(t.timestamp, range));
  const checkIns = data.checkIns.filter((c) => isInRange(c.timestamp, range));

  const days = daysInRange(range);
  const energyTrend = days.map((day) =>
    dayAverage(checkIns, day, (c) => c.energy)
  );
  const focusTrend = days.map((day) =>
    dayAverage(checkIns, day, (c) => c.focus)
  );

  return {
    startDate: range.start,
    endDate: range.end,
    timeByCategory: sumByCategory(activities),
    completedTaskCount: tasks.length,
    energyTrend,
    focusTrend,
  };
}

/**
 * Time-by-category grouping over a date range, excluding out-of-range records
 * (Requirement 7.1 / Property 16).
 */
export function timeByCategory(
  records: ActivityRecord[],
  range: DateRange
): Record<Category, number> {
  return sumByCategory(records.filter((r) => isInRange(r.startTime, range)));
}

export const aggregator: Aggregator = {
  dailySummary,
  weeklyFigures,
  timeByCategory,
};
