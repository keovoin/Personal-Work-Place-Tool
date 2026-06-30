import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DefaultCheckInScheduler,
  clampRating,
} from '../src/core/checkInScheduler';
import { timeOfDay } from './generators';

let counter = 0;
const scheduler = () => new DefaultCheckInScheduler(() => `c-${(counter += 1)}`);

describe('checkInScheduler', () => {
  // Feature: productivity-dashboard, Property 8: Check-in scheduling — three configured times produce exactly three prompts at those times
  it('Property 8: produces exactly the configured prompts', () => {
    fc.assert(
      fc.property(
        fc.tuple(timeOfDay(), timeOfDay(), timeOfDay()),
        (times) => {
          const prompts = scheduler().scheduledPrompts(
            times,
            new Date(Date.UTC(2024, 0, 1))
          );
          expect(prompts).toHaveLength(3);
          prompts.forEach((p, i) => {
            expect(p.time).toEqual(times[i]);
            expect(p.skipped).toBe(false);
            expect(p.isReissue).toBe(false);
          });
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 9: Dismissed check-in is skipped and reissued once at t + 30 minutes
  it('Property 9: dismissed prompt is skipped and reissued once 30 min later', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2030, 0, 1) }),
        (ms) => {
          const now = new Date(ms);
          const prompt = scheduler().scheduledPrompts(
            [{ hour: 10, minute: 0 }, { hour: 14, minute: 0 }, { hour: 17, minute: 0 }],
            now
          )[0];
          const reissue = scheduler().onDismiss(prompt, now);
          expect(reissue.skipped).toBe(true);
          expect(reissue.isReissue).toBe(true);
          const expectedAt = new Date(ms + 30 * 60 * 1000).toISOString();
          expect(reissue.scheduledAt).toBe(expectedAt);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 9: a dismissed reissue is not reissued again', () => {
    const s = scheduler();
    const now = new Date(Date.UTC(2024, 0, 1, 10, 0, 0));
    const prompt = s.scheduledPrompts([{ hour: 10, minute: 0 }, { hour: 14, minute: 0 }, { hour: 17, minute: 0 }], now)[0];
    const reissue = s.onDismiss(prompt, now);
    const second = s.onDismiss(reissue, new Date(now.getTime() + 30 * 60 * 1000));
    expect(second.isReissue).toBe(true);
    // No further +30 jump: stays at the reissue time.
    expect(second.scheduledAt).toBe(reissue.scheduledAt);
  });

  // Feature: productivity-dashboard, Property 10: Rating clamping — persisted ratings lie in [1,5], idempotent
  it('Property 10: ratings are clamped into [1,5] and clamping is idempotent', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), (energy, focus) => {
        const entry = scheduler().onSubmit(energy, focus, new Date());
        expect(entry.energy).toBeGreaterThanOrEqual(1);
        expect(entry.energy).toBeLessThanOrEqual(5);
        expect(entry.focus).toBeGreaterThanOrEqual(1);
        expect(entry.focus).toBeLessThanOrEqual(5);
        if (energy >= 1 && energy <= 5) expect(entry.energy).toBe(energy);
        if (energy < 1) expect(entry.energy).toBe(1);
        if (energy > 5) expect(entry.energy).toBe(5);
        // idempotence
        expect(clampRating(clampRating(energy))).toBe(clampRating(energy));
      }),
      { numRuns: 200 }
    );
  });
});
