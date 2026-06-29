import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pollStep } from '../src/core/timeTracker';
import { ActiveWindow, EMPTY_TRACKER_STATE, TrackerState } from '../src/shared/types';

const THRESHOLD = 300;
let counter = 0;
const id = () => `id-${(counter += 1)}`;

describe('timeTracker', () => {
  // Feature: productivity-dashboard, Property 1: Time accumulation and window split
  it('Property 1: accumulates summed elapsed intervals while window is unchanged', () => {
    fc.assert(
      fc.property(
        // monotonic increasing offsets (seconds) for a sequence of polls
        fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 1, maxLength: 20 }),
        (gaps) => {
          const window: ActiveWindow = { appName: 'Editor', windowTitle: 'a.ts' };
          let state: TrackerState = EMPTY_TRACKER_STATE;
          let t = Date.UTC(2024, 0, 1, 9, 0, 0);
          // first poll establishes the record at t
          state = pollStep(state, new Date(t), window, 0, THRESHOLD, true, id);
          let expected = 0;
          for (const g of gaps) {
            t += g * 1000;
            expected += g;
            state = pollStep(state, new Date(t), window, 0, THRESHOLD, true, id);
          }
          expect(state.current).not.toBeNull();
          expect(state.current!.durationSeconds).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 1: window change emits completed record with previous window fields', () => {
    const w1: ActiveWindow = { appName: 'Editor', windowTitle: 'a.ts' };
    const w2: ActiveWindow = { appName: 'Browser', windowTitle: 'docs' };
    const t0 = new Date(Date.UTC(2024, 0, 1, 9, 0, 0));
    const t1 = new Date(Date.UTC(2024, 0, 1, 9, 0, 30));
    let state = pollStep(EMPTY_TRACKER_STATE, t0, w1, 0, THRESHOLD, true, id);
    state = pollStep(state, t1, w2, 0, THRESHOLD, true, id);
    expect(state.completed).toHaveLength(1);
    expect(state.completed[0].appName).toBe('Editor');
    expect(state.completed[0].windowTitle).toBe('a.ts');
    expect(state.completed[0].startTime).toBe(t0.toISOString());
    expect(state.current!.appName).toBe('Browser');
  });

  // Feature: productivity-dashboard, Property 2: Idle threshold detection
  it('Property 2: idle >= threshold marks isIdle and halts accumulation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: THRESHOLD, max: 5000 }),
        fc.integer({ min: 0, max: THRESHOLD - 1 }),
        (idleHigh, idleLow) => {
          const w: ActiveWindow = { appName: 'Editor', windowTitle: 'a.ts' };
          const t0 = new Date(Date.UTC(2024, 0, 1, 9, 0, 0));
          const t1 = new Date(Date.UTC(2024, 0, 1, 9, 0, 60));
          const t2 = new Date(Date.UTC(2024, 0, 1, 9, 1, 60));
          // establish + accumulate while active
          let state = pollStep(EMPTY_TRACKER_STATE, t0, w, idleLow, THRESHOLD, true, id);
          state = pollStep(state, t1, w, idleLow, THRESHOLD, true, id);
          const before = state.current!.durationSeconds;
          expect(state.current!.isIdle).toBe(false);
          // idle poll -> marked idle, no accumulation
          state = pollStep(state, t2, w, idleHigh, THRESHOLD, true, id);
          expect(state.current!.isIdle).toBe(true);
          expect(state.current!.durationSeconds).toBeCloseTo(before, 5);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: productivity-dashboard, Property 18: Tracking gate
  it('Property 18: no completed records are produced while tracking is disabled', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            app: fc.constantFrom('A', 'B', 'C'),
            title: fc.constantFrom('x', 'y', 'z'),
            gap: fc.integer({ min: 1, max: 60 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (polls) => {
          let state: TrackerState = EMPTY_TRACKER_STATE;
          let t = Date.UTC(2024, 0, 1, 9, 0, 0);
          for (const p of polls) {
            t += p.gap * 1000;
            state = pollStep(
              state,
              new Date(t),
              { appName: p.app, windowTitle: p.title },
              0,
              THRESHOLD,
              false, // disabled
              id
            );
            expect(state.completed).toHaveLength(0);
            expect(state.current).toBeNull();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 18: completed records appear when enabled and window changes', () => {
    const t0 = new Date(Date.UTC(2024, 0, 1, 9, 0, 0));
    const t1 = new Date(Date.UTC(2024, 0, 1, 9, 0, 10));
    let state = pollStep(EMPTY_TRACKER_STATE, t0, { appName: 'A', windowTitle: 'x' }, 0, THRESHOLD, true, id);
    state = pollStep(state, t1, { appName: 'B', windowTitle: 'y' }, 0, THRESHOLD, true, id);
    expect(state.completed.length).toBe(1);
  });
});
