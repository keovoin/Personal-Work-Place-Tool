/**
 * Manual, idle-aware time tracker for the web app.
 *
 * A browser tab can't see which other application you're using, so tracking is
 * manual: you enter a label + category and press Start. Under the hood this
 * reuses the exact same pure `pollStep` function as the desktop app, driving it
 * once per second. Switching the label/category emits a completed record (the
 * pure split behavior); pressing Stop finalizes the in-progress record.
 *
 * Optionally, the browser Idle Detection API can auto-pause accumulation when
 * you're idle — mirroring the desktop idle behavior.
 */

import { pollStep } from '@core/timeTracker';
import {
  ActiveWindow,
  ActivityRecord,
  EMPTY_TRACKER_STATE,
  TrackerState,
} from '@shared/types';

const IDLE_THRESHOLD_SECONDS = 60;

export interface TrackerCallbacks {
  onTick(state: { elapsedSeconds: number; label: string; idle: boolean; running: boolean }): void;
  onComplete(record: ActivityRecord): Promise<void> | void;
}

// Minimal typing for the experimental Idle Detection API.
interface IdleDetectorLike {
  userState: 'active' | 'idle';
  screenState: 'locked' | 'unlocked';
  addEventListener(type: 'change', cb: () => void): void;
  start(opts: { threshold: number; signal?: AbortSignal }): Promise<void>;
}

export class WebTracker {
  private state: TrackerState = EMPTY_TRACKER_STATE;
  private interval: number | null = null;
  private running = false;
  private label = '';
  private category: ActivityRecord['category'] = 'Work';
  private idleEnabled = false;
  private userIsIdle = false;
  private idleAbort: AbortController | null = null;

  constructor(private readonly callbacks: TrackerCallbacks) {}

  isRunning(): boolean {
    return this.running;
  }

  /** Begin (or switch to) tracking the given label/category. */
  start(label: string, category: ActivityRecord['category']): void {
    this.label = label.trim() || 'Untitled';
    this.category = category;
    this.running = true;
    if (this.interval === null) {
      this.interval = window.setInterval(() => this.tick(), 1000);
    }
    this.tick();
  }

  /** Stop tracking and finalize the in-progress record. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.interval !== null) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
    const current = this.state.current;
    if (current && current.durationSeconds > 0) {
      await this.callbacks.onComplete({ ...current, category: this.category });
    }
    this.state = EMPTY_TRACKER_STATE;
    this.callbacks.onTick({ elapsedSeconds: 0, label: '', idle: false, running: false });
  }

  private tick(): void {
    const now = new Date();
    const active: ActiveWindow | null = this.running
      ? { appName: this.label, windowTitle: '' }
      : null;
    const idleSeconds = this.idleEnabled && this.userIsIdle ? IDLE_THRESHOLD_SECONDS : 0;

    const next = pollStep(
      this.state,
      now,
      active,
      idleSeconds,
      IDLE_THRESHOLD_SECONDS,
      this.running
    );

    // Persist any record that was completed by a label/category switch.
    for (const record of next.completed) {
      void this.callbacks.onComplete({ ...record, category: this.category });
    }

    this.state = { ...next, completed: [] };
    const current = this.state.current;
    this.callbacks.onTick({
      elapsedSeconds: current ? Math.round(current.durationSeconds) : 0,
      label: current ? current.appName : '',
      idle: current ? current.isIdle : false,
      running: this.running,
    });
  }

  /** Enable/disable idle auto-pause; requests permission on enable. */
  async setIdleAutoPause(enabled: boolean): Promise<{ ok: boolean; message: string }> {
    if (!enabled) {
      this.idleEnabled = false;
      this.userIsIdle = false;
      this.idleAbort?.abort();
      this.idleAbort = null;
      return { ok: true, message: '' };
    }

    if (!('IdleDetector' in window)) {
      return {
        ok: false,
        message: 'Idle Detection isn\u2019t supported in this browser (Chromium only).',
      };
    }

    try {
      // @ts-expect-error experimental API not in lib.dom
      const permission = await IdleDetector.requestPermission();
      if (permission !== 'granted') {
        return { ok: false, message: 'Idle Detection permission was denied.' };
      }
      // @ts-expect-error experimental API not in lib.dom
      const detector: IdleDetectorLike = new IdleDetector();
      this.idleAbort = new AbortController();
      detector.addEventListener('change', () => {
        this.userIsIdle = detector.userState === 'idle';
      });
      await detector.start({
        threshold: IDLE_THRESHOLD_SECONDS * 1000,
        signal: this.idleAbort.signal,
      });
      this.idleEnabled = true;
      return { ok: true, message: 'Idle auto-pause enabled.' };
    } catch (e) {
      return { ok: false, message: `Could not enable Idle Detection: ${String(e)}` };
    }
  }
}
