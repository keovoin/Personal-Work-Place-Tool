/**
 * InsightEngine (Requirements 6.3, 6.4, 6.5, 9.4).
 *
 * Generates textual insights from local data only (no network, no external
 * processing). It always returns at least one insight, and includes an
 * explicit insufficient-data statement when fewer than two distinct days of
 * recorded data exist in the period.
 */

import { InsightEngine } from '../shared/interfaces';
import { Category, PeriodData } from '../shared/types';
import { calendarDay, isInRange } from './dates';

export const INSUFFICIENT_DATA_STATEMENT =
  'Insufficient data is available for reliable insights (fewer than two days of recorded data).';

function distinctDataDays(period: PeriodData): number {
  const days = new Set<string>();
  for (const a of period.activities) {
    if (isInRange(a.startTime, period.range)) days.add(calendarDay(a.startTime));
  }
  for (const t of period.tasks) {
    if (isInRange(t.timestamp, period.range)) days.add(calendarDay(t.timestamp));
  }
  for (const c of period.checkIns) {
    if (isInRange(c.timestamp, period.range)) days.add(calendarDay(c.timestamp));
  }
  return days.size;
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

/** Generates >= 1 insight from local period data only. */
export function generate(period: PeriodData): string[] {
  const insights: string[] = [];

  const activities = period.activities.filter((a) =>
    isInRange(a.startTime, period.range)
  );
  const tasks = period.tasks.filter((t) => isInRange(t.timestamp, period.range));
  const checkIns = period.checkIns.filter((c) =>
    isInRange(c.timestamp, period.range)
  );

  const dataDays = distinctDataDays(period);

  // Insufficient-data statement (Requirement 6.4 / Property 15).
  if (dataDays < 2) {
    insights.push(INSUFFICIENT_DATA_STATEMENT);
  }

  // Time-by-category insight.
  const byCategory: Record<Category, number> = {
    Work: 0,
    Break: 0,
    Distraction: 0,
    Uncategorized: 0,
  };
  for (const a of activities) byCategory[a.category] += a.durationSeconds;
  const totalTracked =
    byCategory.Work +
    byCategory.Break +
    byCategory.Distraction +
    byCategory.Uncategorized;

  if (totalTracked > 0) {
    const topCategory = (Object.keys(byCategory) as Category[]).reduce((a, b) =>
      byCategory[a] >= byCategory[b] ? a : b
    );
    insights.push(
      `You tracked ${formatHours(totalTracked)} this period; the most time went to ${topCategory} (${formatHours(byCategory[topCategory])}).`
    );

    const distractionRatio = byCategory.Distraction / totalTracked;
    if (distractionRatio >= 0.25) {
      insights.push(
        `Distraction accounted for ${Math.round(distractionRatio * 100)}% of tracked time — consider tightening focus blocks.`
      );
    } else if (byCategory.Work / totalTracked >= 0.6) {
      insights.push(
        `Strong focus: ${Math.round((byCategory.Work / totalTracked) * 100)}% of your tracked time was Work.`
      );
    }
  }

  // Task throughput insight.
  if (tasks.length > 0) {
    insights.push(
      `You logged ${tasks.length} completed task${tasks.length === 1 ? '' : 's'} this period.`
    );
  }

  // Energy / focus insight.
  if (checkIns.length > 0) {
    const avgEnergy =
      checkIns.reduce((s, c) => s + c.energy, 0) / checkIns.length;
    const avgFocus =
      checkIns.reduce((s, c) => s + c.focus, 0) / checkIns.length;
    insights.push(
      `Average energy was ${avgEnergy.toFixed(1)}/5 and focus ${avgFocus.toFixed(1)}/5 across ${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'}.`
    );
  }

  // Guarantee at least one insight (Requirement 6.3 / Property 14).
  if (insights.length === 0) {
    insights.push(
      'No activity was recorded for this period yet. Enable tracking and log a task to start building insights.'
    );
  }

  return insights;
}

export const insightEngine: InsightEngine = { generate };
