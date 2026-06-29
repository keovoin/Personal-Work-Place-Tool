/**
 * Report builders that compose the Aggregator and InsightEngine (Requirement 6).
 */

import { DateRange, PeriodData, WeeklyReport, DayData } from '../shared/types';
import { weeklyFigures, dailySummary } from './aggregator';
import { generate } from './insightEngine';
import { calendarDay } from './dates';

/** Builds the full Weekly_Report (figures + at-least-one insight). */
export function buildWeeklyReport(
  range: DateRange,
  data: PeriodData
): WeeklyReport {
  const figures = weeklyFigures(range, data);
  const insights = generate(data);
  return { ...figures, insights };
}

/** Slices a period's records down to a single calendar day's DayData. */
export function dayDataFor(date: string, data: PeriodData): DayData {
  return {
    date,
    activities: data.activities.filter(
      (a) => calendarDay(a.startTime) === date
    ),
    tasks: data.tasks.filter((t) => calendarDay(t.timestamp) === date),
    checkIns: data.checkIns.filter((c) => calendarDay(c.timestamp) === date),
  };
}

export { dailySummary };
