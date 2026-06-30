import { describe, it, expect } from 'vitest';
import {
  DefaultTrayController,
  TRAY_ITEM_IDS,
} from '../src/main/trayController';

describe('TrayController', () => {
  // Requirement 8.5: tracking defaults to disabled on every startup
  it('Requirement 8.5: tracking defaults to disabled', () => {
    const controller = new DefaultTrayController();
    expect(controller.isTrackingEnabled()).toBe(false);
  });

  // Requirement 8.2: menu exposes dashboard, log task, and tracking toggle
  it('Requirement 8.2: menu contains the expected controls', () => {
    const controller = new DefaultTrayController();
    const ids = controller.buildMenu().map((i) => i.id);
    expect(ids).toContain(TRAY_ITEM_IDS.openDashboard);
    expect(ids).toContain(TRAY_ITEM_IDS.logTask);
    expect(ids).toContain(TRAY_ITEM_IDS.toggleTracking);
  });

  it('toggle label and checkbox reflect tracking state', () => {
    const controller = new DefaultTrayController();
    let menu = controller.buildMenu();
    let toggle = menu.find((i) => i.id === TRAY_ITEM_IDS.toggleTracking)!;
    expect(toggle.label).toBe('Enable Tracking');
    expect(toggle.checked).toBe(false);

    controller.setTrackingEnabled(true);
    menu = controller.buildMenu();
    toggle = menu.find((i) => i.id === TRAY_ITEM_IDS.toggleTracking)!;
    expect(toggle.label).toBe('Disable Tracking');
    expect(toggle.checked).toBe(true);
  });

  it('invokes the toggle callback when tracking changes', () => {
    const seen: boolean[] = [];
    const controller = new DefaultTrayController({
      onToggleTracking: (e) => seen.push(e),
    });
    controller.setTrackingEnabled(true);
    controller.setTrackingEnabled(false);
    expect(seen).toEqual([true, false]);
  });
});
