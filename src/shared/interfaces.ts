/**
 * Component interfaces for the Hybrid Productivity Dashboard.
 *
 * Each requirement maps to one component behind a stable interface, allowing
 * the system to grow incrementally. The pure domain core depends only on these
 * interfaces and the shared types; platform-coupled implementations live in the
 * main process and persistence layer.
 */

import {
  ActiveWindow,
  ActivityRecord,
  Category,
  CategoryRule,
  CheckInEntry,
  DailySummary,
  DateRange,
  DayData,
  InitResult,
  PeriodData,
  Result,
  ScheduledPrompt,
  TaskEntry,
  TimeOfDay,
  TrackerState,
  ValidationError,
  WeeklyFigures,
} from './types';

/** Requirement 1, 8.3, 8.4, 10.1 */
export interface TimeTracker {
  /**
   * Pure step function: given the previous state, the current time, the active
   * window, and the system idle seconds, returns the next tracker state
   * (accumulating, splitting, or marking idle as appropriate).
   */
  poll(
    previousState: TrackerState,
    now: Date,
    active: ActiveWindow | null,
    systemIdleSeconds: number,
    idleThresholdSeconds: number,
    enabled: boolean
  ): TrackerState;
}

/** Requirement 2 */
export interface Categorizer {
  categorize(appName: string, rules: CategoryRule[]): Category;
  applyRulesToRecords(
    records: ActivityRecord[],
    rules: CategoryRule[]
  ): ActivityRecord[];
}

/** Requirement 3, 10.2 */
export interface TaskLogger {
  add(description: string, now: Date): Result<TaskEntry, ValidationError>;
  edit(id: string, description: string): Result<TaskEntry, ValidationError>;
  delete(id: string): void;
  list(): TaskEntry[];
}

/** Requirement 4, 10.3 */
export interface CheckInScheduler {
  scheduledPrompts(times: TimeOfDay[], day: Date): ScheduledPrompt[];
  onSubmit(energy: number, focus: number, now: Date): CheckInEntry;
  onDismiss(prompt: ScheduledPrompt, now: Date): ScheduledPrompt;
}

/** Requirements 5, 6, 7 */
export interface Aggregator {
  dailySummary(date: string, data: DayData): DailySummary;
  weeklyFigures(range: DateRange, data: PeriodData): WeeklyFigures;
  timeByCategory(
    records: ActivityRecord[],
    range: DateRange
  ): Record<Category, number>;
}

/** Requirement 6.3, 6.4, 6.5, 9.4 */
export interface InsightEngine {
  /** Always returns at least one textual insight. */
  generate(period: PeriodData): string[];
}

/** Requirements 9, 11 */
export interface Repository {
  init(): InitResult;
  saveActivity(r: ActivityRecord): void;
  saveTask(t: TaskEntry): void;
  saveCheckIn(c: CheckInEntry): void;
  updateActivityCategory(id: string, category: Category): void;
  setCategoryRule(rule: CategoryRule): void;
  getCategoryRules(): CategoryRule[];
  queryActivities(range: DateRange): ActivityRecord[];
  queryTasks(range: DateRange): TaskEntry[];
  queryCheckIns(range: DateRange): CheckInEntry[];
  deleteTask(id: string): void;
  updateTask(id: string, description: string): void;
  exportAll(filePath: string): void;
  deleteAll(): void;
  close(): void;
}

/** Requirement 8 */
export interface TrayMenuItem {
  id: string;
  label: string;
  type?: 'normal' | 'checkbox' | 'separator';
  checked?: boolean;
}

export interface TrayController {
  showIcon(): void;
  buildMenu(): TrayMenuItem[];
  setTrackingEnabled(enabled: boolean): void;
  isTrackingEnabled(): boolean;
}
