import { describe, it, expect } from 'vitest';
import {
  nextOccurrence,
  DailyTrigger,
  TimerLike,
  TimerHandle,
} from '../src/main/schedulers';
import { formatDailySummaryNotification } from '../src/main/notifications';
import { DailySummary } from '../src/shared/types';

describe('schedulers', () => {
  // Requirement 5.1 / 4.1: next occurrence of a configured time
  it('computes the next occurrence later today', () => {
    const from = new Date(2024, 2, 15, 8, 0, 0);
    const next = nextOccurrence({ hour: 18, minute: 30 }, from);
    expect(next.getHours()).toBe(18);
    expect(next.getMinutes()).toBe(30);
    expect(next.getDate()).toBe(15);
  });

  it('rolls to tomorrow when the time has already passed', () => {
    const from = new Date(2024, 2, 15, 20, 0, 0);
    const next = nextOccurrence({ hour: 9, minute: 0 }, from);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
  });

  // Integration: end-of-day trigger fires the callback (Requirement 5.1)
  it('DailyTrigger fires its callback when the scheduled delay elapses', () => {
    let armedDelay = -1;
    let fireFn: (() => void) | null = null;
    const fakeTimer: TimerLike = {
      setTimeout: (handler, ms) => {
        armedDelay = ms;
        fireFn = handler;
        return 1 as unknown as TimerHandle;
      },
      clearTimeout: () => undefined,
    };
    let fired = 0;
    const trigger = new DailyTrigger(
      { hour: 18, minute: 0 },
      () => {
        fired += 1;
      },
      () => new Date(2024, 2, 15, 17, 0, 0),
      fakeTimer
    );
    trigger.start();
    expect(armedDelay).toBe(60 * 60 * 1000); // 1 hour until 18:00
    expect(fireFn).not.toBeNull();
    fireFn!();
    expect(fired).toBe(1);
  });
});

describe('daily summary notification', () => {
  // Requirement 5.3 / 5.4: notification content (incl. empty day)
  it('reports "no activity" for an empty day', () => {
    const summary: DailySummary = {
      date: '2024-03-15',
      timeByCategory: { Work: 0, Break: 0, Distraction: 0, Uncategorized: 0 },
      completedTaskCount: 0,
      averageEnergy: null,
      averageFocus: null,
      empty: true,
    };
    const content = formatDailySummaryNotification(summary);
    expect(content.body.toLowerCase()).toContain('no activity');
  });

  it('summarizes tracked time, tasks, and ratings for a non-empty day', () => {
    const summary: DailySummary = {
      date: '2024-03-15',
      timeByCategory: { Work: 7200, Break: 600, Distraction: 0, Uncategorized: 0 },
      completedTaskCount: 3,
      averageEnergy: 4,
      averageFocus: 3.5,
      empty: false,
    };
    const content = formatDailySummaryNotification(summary);
    expect(content.body).toContain('Work: 2h 0m');
    expect(content.body).toContain('Tasks: 3');
    expect(content.body).toContain('Energy: 4.0/5');
  });
});
