/**
 * TimeTracker step logic (Requirements 1, 8.3, 8.4, 10.1).
 *
 * A pure function of (previousState, now, active, systemIdleSeconds,
 * idleThreshold, enabled). It accumulates active time while the window is
 * unchanged, splits and emits a completed record when the window changes,
 * marks the record idle (halting accumulation) when the system is idle, and is
 * gated so that records are produced only while tracking is enabled.
 */

import { TimeTracker } from '../shared/interfaces';
import {
  ActiveWindow,
  ActivityRecord,
  EMPTY_TRACKER_STATE,
  TrackerState,
} from '../shared/types';

let idCounter = 0;
function defaultIdFactory(): string {
  idCounter += 1;
  return `act-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function sameWindow(a: ActiveWindow, r: ActivityRecord): boolean {
  return a.appName === r.appName && a.windowTitle === r.windowTitle;
}

/**
 * Pure step function. `idFactory` is injectable so tests can be deterministic.
 */
export function pollStep(
  previousState: TrackerState,
  now: Date,
  active: ActiveWindow | null,
  systemIdleSeconds: number,
  idleThresholdSeconds: number,
  enabled: boolean,
  idFactory: () => string = defaultIdFactory
): TrackerState {
  // Tracking gate (Requirement 8.3, 8.4 / Property 18): no records while
  // disabled, and tracking restarts fresh when re-enabled.
  if (!enabled) {
    return { current: null, completed: [], lastPollTime: null };
  }

  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const lastMs =
    previousState.lastPollTime !== null
      ? new Date(previousState.lastPollTime).getTime()
      : nowMs;
  const elapsedSeconds = Math.max(0, (nowMs - lastMs) / 1000);
  const isIdleNow = systemIdleSeconds >= idleThresholdSeconds;

  // No current record: start one if we have an active window.
  if (previousState.current === null) {
    if (active === null) {
      return { current: null, completed: [], lastPollTime: nowIso };
    }
    const fresh: ActivityRecord = {
      id: idFactory(),
      appName: active.appName,
      windowTitle: active.windowTitle,
      startTime: nowIso,
      durationSeconds: 0,
      category: 'Uncategorized',
      isIdle: isIdleNow,
    };
    return { current: fresh, completed: [], lastPollTime: nowIso };
  }

  const prev = previousState.current;
  const wasIdle = prev.isIdle;

  // Decide whether this interval contributes to active duration.
  // Skip accumulation while idle, and skip the gap on the poll that resumes
  // from idle (Requirement 1.4 / Property 2).
  const shouldAccumulate = !isIdleNow && !wasIdle;
  const accumulated: ActivityRecord = {
    ...prev,
    durationSeconds: shouldAccumulate
      ? prev.durationSeconds + elapsedSeconds
      : prev.durationSeconds,
    isIdle: isIdleNow,
  };

  // A failed active-window read is treated as "no change" for this interval.
  const windowChanged = active !== null && !sameWindow(active, prev);

  if (!windowChanged) {
    return { current: accumulated, completed: [], lastPollTime: nowIso };
  }

  // Window changed: finalize the previous record and start a new one.
  const completedRecord: ActivityRecord = { ...accumulated };
  const next: ActivityRecord = {
    id: idFactory(),
    appName: active!.appName,
    windowTitle: active!.windowTitle,
    startTime: nowIso,
    durationSeconds: 0,
    category: 'Uncategorized',
    isIdle: isIdleNow,
  };
  return { current: next, completed: [completedRecord], lastPollTime: nowIso };
}

export const timeTracker: TimeTracker = {
  poll(previousState, now, active, systemIdleSeconds, idleThresholdSeconds, enabled) {
    return pollStep(
      previousState,
      now,
      active,
      systemIdleSeconds,
      idleThresholdSeconds,
      enabled
    );
  },
};

export { EMPTY_TRACKER_STATE };
