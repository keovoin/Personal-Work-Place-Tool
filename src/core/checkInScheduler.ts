/**
 * CheckInScheduler and rating clamping (Requirements 4, 10.3).
 *
 * Produces exactly the configured daily prompts, reissues a dismissed prompt
 * once 30 minutes later, and clamps submitted energy/focus ratings into the
 * inclusive 1..5 range before producing a CheckInEntry.
 */

import { CheckInScheduler } from '../shared/interfaces';
import { CheckInEntry, ScheduledPrompt, TimeOfDay } from '../shared/types';

const REISSUE_DELAY_MINUTES = 30;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Clamps a rating to the inclusive [1, 5] range; idempotent. */
export function clampRating(value: number): number {
  if (Number.isNaN(value)) return RATING_MIN;
  const truncated = Math.trunc(value);
  if (truncated < RATING_MIN) return RATING_MIN;
  if (truncated > RATING_MAX) return RATING_MAX;
  return truncated;
}

/** Builds the ISO timestamp for a time-of-day on a given calendar day (UTC). */
function promptTimestamp(day: Date, time: TimeOfDay): string {
  const d = new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      time.hour,
      time.minute,
      0,
      0
    )
  );
  return d.toISOString();
}

let checkInCounter = 0;
function defaultIdFactory(): string {
  checkInCounter += 1;
  return `chk-${Date.now().toString(36)}-${checkInCounter.toString(36)}`;
}

export class DefaultCheckInScheduler implements CheckInScheduler {
  constructor(private readonly idFactory: () => string = defaultIdFactory) {}

  /** One prompt per configured time on the given day (Property 8). */
  scheduledPrompts(times: TimeOfDay[], day: Date): ScheduledPrompt[] {
    return times.map((time) => ({
      time,
      scheduledAt: promptTimestamp(day, time),
      skipped: false,
      isReissue: false,
    }));
  }

  /** Clamp ratings, then produce a submitted entry (Property 10). */
  onSubmit(energy: number, focus: number, now: Date): CheckInEntry {
    return {
      id: this.idFactory(),
      energy: clampRating(energy),
      focus: clampRating(focus),
      timestamp: now.toISOString(),
      skipped: false,
    };
  }

  /**
   * Mark a dismissed prompt as skipped and produce exactly one reissue at
   * now + 30 minutes (Property 9). The returned prompt is the reissue.
   */
  onDismiss(prompt: ScheduledPrompt, now: Date): ScheduledPrompt {
    if (prompt.isReissue) {
      // A reissue that is itself dismissed is not reissued again; mark skipped.
      return { ...prompt, skipped: true };
    }
    const reissueAt = new Date(now.getTime() + REISSUE_DELAY_MINUTES * 60 * 1000);
    return {
      time: prompt.time,
      scheduledAt: reissueAt.toISOString(),
      skipped: true,
      isReissue: true,
    };
  }
}
