/**
 * TrayController (Requirement 8).
 *
 * Holds the tracking-enabled flag (defaulting to DISABLED on every startup,
 * Requirement 8.5) and builds the tray menu model. The actual Electron Tray /
 * Menu objects are constructed in main.ts from this model, so this controller
 * stays free of Electron imports and is fully unit-testable.
 */

import { TrayController, TrayMenuItem } from '../shared/interfaces';

export interface TrayCallbacks {
  onOpenDashboard?(): void;
  onLogTask?(): void;
  onToggleTracking?(enabled: boolean): void;
  onShowIcon?(): void;
}

export const TRAY_ITEM_IDS = {
  openDashboard: 'open-dashboard',
  logTask: 'log-task',
  toggleTracking: 'toggle-tracking',
  quit: 'quit',
} as const;

export class DefaultTrayController implements TrayController {
  // Requirement 8.5: tracking always starts disabled on startup.
  private trackingEnabled = false;

  constructor(private readonly callbacks: TrayCallbacks = {}) {}

  showIcon(): void {
    this.callbacks.onShowIcon?.();
  }

  buildMenu(): TrayMenuItem[] {
    return [
      { id: TRAY_ITEM_IDS.openDashboard, label: 'Open Dashboard', type: 'normal' },
      { id: TRAY_ITEM_IDS.logTask, label: 'Log Task…', type: 'normal' },
      { id: '', label: '', type: 'separator' },
      {
        id: TRAY_ITEM_IDS.toggleTracking,
        label: this.trackingEnabled ? 'Disable Tracking' : 'Enable Tracking',
        type: 'checkbox',
        checked: this.trackingEnabled,
      },
      { id: '', label: '', type: 'separator' },
      { id: TRAY_ITEM_IDS.quit, label: 'Quit', type: 'normal' },
    ];
  }

  setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
    this.callbacks.onToggleTracking?.(enabled);
  }

  isTrackingEnabled(): boolean {
    return this.trackingEnabled;
  }
}
