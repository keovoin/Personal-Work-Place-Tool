/**
 * Daily summary notification formatting (Requirement 5).
 *
 * The formatter is a pure function so it can be tested without Electron; the
 * dispatch wrapper (showNotification) is the only Electron-coupled part.
 */

import { Category, DailySummary } from '../shared/types';

export interface NotificationContent {
  title: string;
  body: string;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Builds the notification content for a Daily_Summary (incl. empty days). */
export function formatDailySummaryNotification(
  summary: DailySummary
): NotificationContent {
  if (summary.empty) {
    return {
      title: `Daily Summary — ${summary.date}`,
      body: 'No activity was recorded today.',
    };
  }

  const order: Category[] = ['Work', 'Break', 'Distraction', 'Uncategorized'];
  const parts = order
    .filter((c) => summary.timeByCategory[c] > 0)
    .map((c) => `${c}: ${formatDuration(summary.timeByCategory[c])}`);

  const timeLine = parts.length > 0 ? parts.join(' · ') : 'No tracked time';
  const energy =
    summary.averageEnergy === null
      ? '—'
      : summary.averageEnergy.toFixed(1);
  const focus =
    summary.averageFocus === null ? '—' : summary.averageFocus.toFixed(1);

  return {
    title: `Daily Summary — ${summary.date}`,
    body: `${timeLine}\nTasks: ${summary.completedTaskCount} · Energy: ${energy}/5 · Focus: ${focus}/5`,
  };
}
