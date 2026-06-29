/**
 * Core domain types for the Hybrid Productivity Dashboard.
 *
 * These types are shared across the pure domain core, the persistence layer,
 * the Electron main process, and the renderer. They are intentionally
 * dependency-free so they can be imported anywhere without coupling.
 */

// ---------------------------------------------------------------------------
// Category (Requirement 2)
// ---------------------------------------------------------------------------

/** A classification label for an Activity_Record. */
export type Category = 'Work' | 'Break' | 'Distraction' | 'Uncategorized';

/** All category values, ordered. Useful for building zeroed maps. */
export const CATEGORIES: readonly Category[] = [
  'Work',
  'Break',
  'Distraction',
  'Uncategorized',
] as const;

// ---------------------------------------------------------------------------
// Activity tracking (Requirement 1, 2)
// ---------------------------------------------------------------------------

/** The currently active OS window, as reported by the platform. */
export interface ActiveWindow {
  appName: string;
  windowTitle: string;
}

/**
 * A stored entry capturing an active window's application name, window title,
 * start time, and accumulated active duration.
 */
export interface ActivityRecord {
  id: string;
  appName: string;
  windowTitle: string;
  /** ISO 8601 timestamp marking when this window became active. */
  startTime: string;
  /** Accumulated active seconds, always >= 0. */
  durationSeconds: number;
  category: Category;
  isIdle: boolean;
}

/** A user-defined rule mapping an application name to a category. */
export interface CategoryRule {
  /** Matched case-insensitively against ActivityRecord.appName. */
  appName: string;
  /** Never 'Uncategorized' as a rule target. */
  category: Exclude<Category, 'Uncategorized'>;
}

/** The mutable result of stepping the TimeTracker forward by one poll. */
export interface TrackerState {
  /** The in-progress record, or null when nothing is being tracked. */
  current: ActivityRecord | null;
  /** Records that have been completed during the most recent poll. */
  completed: ActivityRecord[];
  /** ISO 8601 timestamp of the last poll; null before tracking begins. */
  lastPollTime: string | null;
}

/** The empty starting state for a TimeTracker. */
export const EMPTY_TRACKER_STATE: TrackerState = {
  current: null,
  completed: [],
  lastPollTime: null,
};

// ---------------------------------------------------------------------------
// Task logging (Requirement 3)
// ---------------------------------------------------------------------------

/** A user-created record describing a completed task. */
export interface TaskEntry {
  id: string;
  /** Non-empty, non-whitespace-only. */
  description: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Check-ins (Requirement 4)
// ---------------------------------------------------------------------------

/** A stored energy/focus check-in record. */
export interface CheckInEntry {
  id: string;
  /** Integer 1..5 after clamping. */
  energy: number;
  /** Integer 1..5 after clamping. */
  focus: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** True when the prompt was dismissed without submission. */
  skipped: boolean;
}

/** A time of day expressed in 24-hour hours and minutes. */
export interface TimeOfDay {
  hour: number; // 0..23
  minute: number; // 0..59
}

/** A scheduled check-in prompt. */
export interface ScheduledPrompt {
  /** The originally scheduled time of day. */
  time: TimeOfDay;
  /** ISO 8601 timestamp at which this prompt should fire. */
  scheduledAt: string;
  /** True once the user dismissed the prompt without submitting. */
  skipped: boolean;
  /** True when this prompt is the single +30min reissue of a skipped prompt. */
  isReissue: boolean;
}

// ---------------------------------------------------------------------------
// Settings (Requirements 4, 5, 8)
// ---------------------------------------------------------------------------

export interface Settings {
  /** Exactly 3, configurable. */
  checkInTimes: TimeOfDay[];
  endOfDayTime: TimeOfDay;
  /** Default 300 (5 minutes). */
  idleThresholdSeconds: number;
  /** Must be <= 5. */
  pollIntervalSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  checkInTimes: [
    { hour: 10, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 17, minute: 0 },
  ],
  endOfDayTime: { hour: 18, minute: 0 },
  idleThresholdSeconds: 300,
  pollIntervalSeconds: 5,
};

// ---------------------------------------------------------------------------
// Reporting (Requirements 5, 6, 7)
// ---------------------------------------------------------------------------

/** An inclusive calendar-day range. Both ends are ISO date strings (YYYY-MM-DD). */
export interface DateRange {
  start: string;
  end: string;
}

export interface DailySummary {
  /** Calendar day (YYYY-MM-DD). */
  date: string;
  /** Seconds per category. */
  timeByCategory: Record<Category, number>;
  completedTaskCount: number;
  /** Null when no check-ins exist for the day. */
  averageEnergy: number | null;
  averageFocus: number | null;
  /** True when no data exists for the day. */
  empty: boolean;
}

export interface WeeklyFigures {
  startDate: string;
  endDate: string;
  timeByCategory: Record<Category, number>;
  completedTaskCount: number;
  /** Per-day average energy across the period (one entry per day). */
  energyTrend: number[];
  /** Per-day average focus across the period (one entry per day). */
  focusTrend: number[];
}

export interface WeeklyReport extends WeeklyFigures {
  /** Always length >= 1. */
  insights: string[];
}

// ---------------------------------------------------------------------------
// Data bundles passed to pure aggregation functions
// ---------------------------------------------------------------------------

/** All of a single calendar day's records. */
export interface DayData {
  date: string;
  activities: ActivityRecord[];
  tasks: TaskEntry[];
  checkIns: CheckInEntry[];
}

/** All records across a multi-day reporting period. */
export interface PeriodData {
  range: DateRange;
  activities: ActivityRecord[];
  tasks: TaskEntry[];
  checkIns: CheckInEntry[];
}

/** The full dataset, used for serialization/export. */
export interface Dataset {
  activities: ActivityRecord[];
  tasks: TaskEntry[];
  checkIns: CheckInEntry[];
  rules: CategoryRule[];
  settings: Settings;
}

// ---------------------------------------------------------------------------
// Result / validation helpers (Requirement 3)
// ---------------------------------------------------------------------------

export interface ValidationError {
  kind: 'ValidationError';
  message: string;
}

export type Result<T, E = ValidationError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function validationError(message: string): ValidationError {
  return { kind: 'ValidationError', message };
}

/** Result of initializing the persistence layer. */
export type InitResult = 'created' | 'loaded' | 'recovered' | 'no-persistence';
