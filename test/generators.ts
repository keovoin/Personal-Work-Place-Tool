/**
 * Shared fast-check generators for the property-based tests.
 */

import fc from 'fast-check';
import {
  ActivityRecord,
  Category,
  CategoryRule,
  CheckInEntry,
  Dataset,
  Settings,
  TaskEntry,
} from '../src/shared/types';

const CATEGORIES: Category[] = ['Work', 'Break', 'Distraction', 'Uncategorized'];
const RULE_CATEGORIES: CategoryRule['category'][] = [
  'Work',
  'Break',
  'Distraction',
];

/** A reasonable epoch range: 2020-01-01 .. 2030-01-01. */
const MIN_EPOCH = Date.UTC(2020, 0, 1);
const MAX_EPOCH = Date.UTC(2030, 0, 1);

export const isoTimestamp = (): fc.Arbitrary<string> =>
  fc
    .integer({ min: MIN_EPOCH, max: MAX_EPOCH })
    .map((ms) => new Date(ms).toISOString());

/** A timestamp on a specific calendar day (UTC). */
export const isoTimestampOnDay = (day: string): fc.Arbitrary<string> => {
  const base = Date.parse(`${day}T00:00:00.000Z`);
  return fc
    .integer({ min: 0, max: 24 * 60 * 60 * 1000 - 1 })
    .map((offset) => new Date(base + offset).toISOString());
};

export const category = (): fc.Arbitrary<Category> =>
  fc.constantFrom(...CATEGORIES);

export const activityRecord = (): fc.Arbitrary<ActivityRecord> =>
  fc.record({
    id: fc.uuid(),
    appName: fc.string({ minLength: 1, maxLength: 20 }),
    windowTitle: fc.string({ maxLength: 30 }),
    startTime: isoTimestamp(),
    durationSeconds: fc.integer({ min: 0, max: 100000 }),
    category: category(),
    isIdle: fc.boolean(),
  });

export const taskEntry = (): fc.Arbitrary<TaskEntry> =>
  fc.record({
    id: fc.uuid(),
    description: fc.string({ minLength: 1, maxLength: 80 }),
    timestamp: isoTimestamp(),
  });

export const checkInEntry = (): fc.Arbitrary<CheckInEntry> =>
  fc.record({
    id: fc.uuid(),
    energy: fc.integer({ min: 1, max: 5 }),
    focus: fc.integer({ min: 1, max: 5 }),
    timestamp: isoTimestamp(),
    skipped: fc.boolean(),
  });

export const categoryRule = (): fc.Arbitrary<CategoryRule> =>
  fc.record({
    appName: fc.string({ minLength: 1, maxLength: 20 }),
    category: fc.constantFrom(...RULE_CATEGORIES),
  });

export const settings = (): fc.Arbitrary<Settings> =>
  fc.record({
    checkInTimes: fc.tuple(timeOfDay(), timeOfDay(), timeOfDay()),
    endOfDayTime: timeOfDay(),
    idleThresholdSeconds: fc.integer({ min: 0, max: 3600 }),
    pollIntervalSeconds: fc.integer({ min: 1, max: 5 }),
  });

export const timeOfDay = () =>
  fc.record({
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
  });

export const dataset = (): fc.Arbitrary<Dataset> =>
  fc.record({
    activities: fc.array(activityRecord(), { maxLength: 12 }),
    tasks: fc.array(taskEntry(), { maxLength: 12 }),
    checkIns: fc.array(checkInEntry(), { maxLength: 12 }),
    rules: fc.array(categoryRule(), { maxLength: 6 }),
    settings: settings(),
  });
