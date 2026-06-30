/**
 * Pure calendar-date helpers used by the aggregation, filtering, and scheduling
 * logic. All functions operate on ISO 8601 strings and UTC calendar days so
 * behavior is deterministic and free of local-timezone surprises in tests.
 */

import { DateRange } from '../shared/types';

/** Returns the YYYY-MM-DD calendar day (UTC) for an ISO timestamp. */
export function calendarDay(isoTimestamp: string): string {
  // Take the date portion of the ISO string after normalizing through Date.
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) {
    // Fall back to a lexical slice for already-normalized inputs.
    return isoTimestamp.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/** True when the timestamp's calendar day falls within the inclusive range. */
export function isInRange(isoTimestamp: string, range: DateRange): boolean {
  const day = calendarDay(isoTimestamp);
  return day >= range.start && day <= range.end;
}

/** Returns the inclusive list of YYYY-MM-DD days spanning a range. */
export function daysInRange(range: DateRange): string[] {
  const out: string[] = [];
  const start = new Date(`${range.start}T00:00:00.000Z`);
  const end = new Date(`${range.end}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return out;
  }
  for (
    let t = start.getTime();
    t <= end.getTime();
    t += 24 * 60 * 60 * 1000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Number of inclusive days in a range. */
export function dayCount(range: DateRange): number {
  return daysInRange(range).length;
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD day, returning YYYY-MM-DD. */
export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds the inclusive 7-day range ending on the given day (the day plus the
 * six preceding days).
 */
export function trailingWeek(endDay: string): DateRange {
  return { start: addDays(endDay, -6), end: endDay };
}
