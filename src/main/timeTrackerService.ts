/**
 * TimeTracker service (Requirements 1.1, 1.5, 8.3, 8.4, 10.1).
 *
 * Drives the pure `pollStep` function on an interval (<= 5s), sourcing the
 * active window from `active-win` and the system idle time from Electron's
 * `powerMonitor.getSystemIdleTime()`. Completed records are persisted via the
 * injected Repository, and polling is gated by the tracking-enabled flag.
 *
 * The window/idle/persist providers are injected so the loop can be tested
 * without Electron or a real desktop session.
 */

import { pollStep } from '../core/timeTracker';
import { categorize } from '../core/categorizer';
import { Repository } from '../shared/interfaces';
import {
  ActiveWindow,
  ActivityRecord,
  CategoryRule,
  EMPTY_TRACKER_STATE,
  TrackerState,
} from '../shared/types';

export interface TrackerProviders {
  getActiveWindow(): Promise<ActiveWindow | null>;
  getIdleSeconds(): number;
  now?(): Date;
}

export class TimeTrackerService {
  private state: TrackerState = EMPTY_TRACKER_STATE;
  private interval: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private rules: CategoryRule[] = [];

  constructor(
    private readonly repo: Repository,
    private readonly providers: TrackerProviders,
    private readonly idleThresholdSeconds: number,
    private readonly pollIntervalSeconds: number
  ) {
    this.rules = repo.getCategoryRules();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Flush nothing; reset tracking state per the gate semantics.
      this.state = EMPTY_TRACKER_STATE;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  refreshRules(): void {
    this.rules = this.repo.getCategoryRules();
  }

  start(): void {
    if (this.interval !== null) return;
    const ms = Math.min(5, Math.max(1, this.pollIntervalSeconds)) * 1000;
    this.interval = setInterval(() => {
      void this.tick();
    }, ms);
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** A single poll cycle. Exposed for integration tests. */
  async tick(): Promise<void> {
    const now = this.providers.now ? this.providers.now() : new Date();
    let active: ActiveWindow | null = null;
    try {
      active = await this.providers.getActiveWindow();
    } catch {
      active = null; // failed read -> treat as no-change for this interval
    }
    const idle = this.providers.getIdleSeconds();

    const next = pollStep(
      this.state,
      now,
      active,
      idle,
      this.idleThresholdSeconds,
      this.enabled
    );

    for (const record of next.completed) {
      const categorized: ActivityRecord = {
        ...record,
        category: categorize(record.appName, this.rules),
      };
      this.repo.saveActivity(categorized);
    }

    // Keep only the in-progress record in state going forward.
    this.state = { ...next, completed: [] };
  }
}
