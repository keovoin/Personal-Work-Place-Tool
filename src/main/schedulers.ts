/**
 * Time-based schedulers for check-in prompts and the end-of-day summary
 * (Requirements 4.1, 5.1).
 *
 * `nextOccurrence` is pure and testable; `DailyTrigger` is the thin timer
 * wrapper that fires a callback at the next occurrence of a time-of-day and
 * re-arms for the following day.
 */

import { TimeOfDay } from '../shared/types';

/** The next Date at/after `from` whose local time matches `time`. */
export function nextOccurrence(time: TimeOfDay, from: Date): Date {
  const candidate = new Date(from);
  candidate.setHours(time.hour, time.minute, 0, 0);
  if (candidate.getTime() <= from.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export type TimerHandle = ReturnType<typeof setTimeout>;

export interface TimerLike {
  setTimeout(handler: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

const realTimer: TimerLike = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle),
};

/** Fires `onFire` at the next occurrence of `time`, re-arming each day. */
export class DailyTrigger {
  private handle: TimerHandle | null = null;

  constructor(
    private readonly time: TimeOfDay,
    private readonly onFire: () => void,
    private readonly now: () => Date = () => new Date(),
    private readonly timer: TimerLike = realTimer
  ) {}

  start(): void {
    this.arm();
  }

  private arm(): void {
    const fireAt = nextOccurrence(this.time, this.now());
    const delay = Math.max(0, fireAt.getTime() - this.now().getTime());
    this.handle = this.timer.setTimeout(() => {
      try {
        this.onFire();
      } finally {
        this.arm(); // re-arm for the next day
      }
    }, delay);
  }

  stop(): void {
    if (this.handle !== null) {
      this.timer.clearTimeout(this.handle);
      this.handle = null;
    }
  }
}

/** Manages a DailyTrigger per configured check-in time. */
export class CheckInPromptScheduler {
  private triggers: DailyTrigger[] = [];

  constructor(
    private readonly times: TimeOfDay[],
    private readonly onPrompt: (time: TimeOfDay) => void,
    private readonly now: () => Date = () => new Date(),
    private readonly timer: TimerLike = realTimer
  ) {}

  start(): void {
    this.stop();
    this.triggers = this.times.map(
      (time) =>
        new DailyTrigger(
          time,
          () => this.onPrompt(time),
          this.now,
          this.timer
        )
    );
    for (const t of this.triggers) t.start();
  }

  stop(): void {
    for (const t of this.triggers) t.stop();
    this.triggers = [];
  }
}
