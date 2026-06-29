/**
 * Electron main process entry (Requirements 8.1, 9.1, 11.1-11.4, 14.1).
 *
 * On launch: initialize the Repository (with startup recovery), construct the
 * domain core with the injected Repository, start the tray (tracking disabled
 * by default), wire IPC handlers, and arm the check-in / end-of-day schedulers.
 *
 * No component performs network I/O — every feature works offline and on-device
 * (Requirements 9 and 10).
 */

import * as path from 'path';
import * as os from 'os';
import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  Notification,
  powerMonitor,
  dialog,
  nativeImage,
} from 'electron';

import { SqliteRepository } from '../data/repository';
import { DefaultTrayController, TRAY_ITEM_IDS } from './trayController';
import { TimeTrackerService } from './timeTrackerService';
import { CheckInPromptScheduler, DailyTrigger } from './schedulers';
import { DefaultCheckInScheduler } from '../core/checkInScheduler';
import { InMemoryTaskLogger } from '../core/taskLogger';
import { dailySummary } from '../core/aggregator';
import { buildWeeklyReport, dayDataFor } from '../core/reports';
import { categorize, applyRulesToRecords } from '../core/categorizer';
import { timeByCategory } from '../core/aggregator';
import { formatDailySummaryNotification } from './notifications';
import { calendarDay, trailingWeek } from '../core/dates';
import { IPC, DashboardData } from '../shared/ipc';
import {
  Category,
  CategoryRule,
  DateRange,
  PeriodData,
  Settings,
} from '../shared/types';

const DATA_DIR = path.join(app.getPath?.('userData') ?? os.tmpdir());
const DB_PATH = path.join(DATA_DIR, 'productivity-dashboard.sqlite');

let tray: Tray | null = null;
let dashboardWindow: BrowserWindow | null = null;
let checkInWindow: BrowserWindow | null = null;

const repo = new SqliteRepository({ filePath: DB_PATH });
const trayController = new DefaultTrayController();
const checkInScheduler = new DefaultCheckInScheduler();
let trackerService: TimeTrackerService;
let settings: Settings;

function periodData(range: DateRange): PeriodData {
  return {
    range,
    activities: repo.queryActivities(range),
    tasks: repo.queryTasks(range),
    checkIns: repo.queryCheckIns(range),
  };
}

async function getActiveWindow() {
  try {
    const activeWin = (await import('active-win')).default;
    const result = await activeWin();
    if (!result) return null;
    return {
      appName: result.owner?.name ?? 'Unknown',
      windowTitle: result.title ?? '',
    };
  } catch {
    return null;
  }
}

function buildTrayMenu(): Menu {
  const items = trayController.buildMenu().map((item) => {
    if (item.type === 'separator') return { type: 'separator' as const };
    return {
      label: item.label,
      type: item.type,
      checked: item.checked,
      click: () => handleTrayClick(item.id),
    };
  });
  return Menu.buildFromTemplate(items);
}

function handleTrayClick(id: string): void {
  switch (id) {
    case TRAY_ITEM_IDS.openDashboard:
      openDashboard();
      break;
    case TRAY_ITEM_IDS.logTask:
      openDashboard('#tasks');
      break;
    case TRAY_ITEM_IDS.toggleTracking:
      setTracking(!trayController.isTrackingEnabled());
      break;
    case TRAY_ITEM_IDS.quit:
      app.quit();
      break;
  }
}

function setTracking(enabled: boolean): void {
  trayController.setTrackingEnabled(enabled);
  trackerService.setEnabled(enabled);
  if (tray) tray.setContextMenu(buildTrayMenu());
  dashboardWindow?.webContents.send(IPC.trackingChanged, enabled);
}

function openDashboard(hash = ''): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }
  dashboardWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Productivity Dashboard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  dashboardWindow.loadFile(
    path.join(__dirname, '../renderer/index.html'),
    hash ? { hash } : undefined
  );
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function openCheckIn(): void {
  if (checkInWindow && !checkInWindow.isDestroyed()) {
    checkInWindow.show();
    checkInWindow.focus();
    return;
  }
  checkInWindow = new BrowserWindow({
    width: 380,
    height: 420,
    title: 'Energy & Focus Check-In',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  checkInWindow.loadFile(path.join(__dirname, '../renderer/checkin.html'));
  checkInWindow.on('closed', () => {
    checkInWindow = null;
  });
}

function showDailySummaryNotification(): void {
  const today = calendarDay(new Date().toISOString());
  const data = periodData({ start: today, end: today });
  const summary = dailySummary(today, dayDataFor(today, data));
  const content = formatDailySummaryNotification(summary);
  if (Notification.isSupported()) {
    new Notification({ title: content.title, body: content.body }).show();
  }
}

function registerIpcHandlers(): void {
  const taskLogger = new InMemoryTaskLogger({
    onSave: (task) => repo.saveTask(task),
    onUpdate: (id, description) => repo.updateTask(id, description),
    onDelete: (id) => repo.deleteTask(id),
  });

  ipcMain.handle(IPC.addTask, (_e, description: string) => {
    const result = taskLogger.add(description, new Date());
    return result.ok
      ? { ok: true, task: result.value }
      : { ok: false, error: result.error.message };
  });

  ipcMain.handle(IPC.editTask, (_e, id: string, description: string) => {
    const result = taskLogger.edit(id, description);
    repo.updateTask(id, description);
    return result.ok
      ? { ok: true, task: result.value }
      : { ok: false, error: result.error.message };
  });

  ipcMain.handle(IPC.deleteTask, (_e, id: string) => {
    repo.deleteTask(id);
    return { ok: true };
  });

  ipcMain.handle(IPC.submitCheckIn, (_e, energy: number, focus: number) => {
    const entry = checkInScheduler.onSubmit(energy, focus, new Date());
    repo.saveCheckIn(entry);
    if (checkInWindow && !checkInWindow.isDestroyed()) checkInWindow.close();
    return { ok: true, entry };
  });

  ipcMain.handle(IPC.dismissCheckIn, () => {
    if (checkInWindow && !checkInWindow.isDestroyed()) checkInWindow.close();
    return { ok: true };
  });

  ipcMain.handle(
    IPC.getDashboardData,
    (_e, start: string, end: string): DashboardData => {
      const range: DateRange = { start, end };
      const data = periodData(range);
      const tbc = timeByCategory(data.activities, range);
      const figures = buildWeeklyReport(range, data);
      return {
        range,
        timeByCategory: tbc as Record<string, number>,
        tasks: data.tasks,
        energyTrend: figures.energyTrend,
        focusTrend: figures.focusTrend,
        days: figures.energyTrend.map((_, i) => `Day ${i + 1}`),
      };
    }
  );

  ipcMain.handle(IPC.getWeeklyReport, (_e, endDay: string) => {
    const range = trailingWeek(endDay);
    return buildWeeklyReport(range, periodData(range));
  });

  ipcMain.handle(
    IPC.setCategoryRule,
    (_e, appName: string, category: Category) => {
      const rule: CategoryRule = {
        appName,
        category: category as CategoryRule['category'],
      };
      repo.setCategoryRule(rule);
      // Requirement 2.3: apply to existing records too.
      const full: DateRange = { start: '0000-01-01', end: '9999-12-31' };
      const updated = applyRulesToRecords(
        repo.queryActivities(full),
        repo.getCategoryRules()
      );
      for (const r of updated) repo.updateActivityCategory(r.id, r.category);
      trackerService.refreshRules();
      return { ok: true };
    }
  );

  ipcMain.handle(
    IPC.setActivityCategory,
    (_e, id: string, category: Category) => {
      repo.updateActivityCategory(id, category);
      return { ok: true };
    }
  );

  ipcMain.handle(IPC.exportData, async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), 'productivity-export.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    try {
      repo.exportAll(result.filePath);
      return { ok: true, filePath: result.filePath };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle(IPC.deleteAllData, () => {
    repo.deleteAll();
    return { ok: true };
  });

  ipcMain.handle(IPC.setTracking, (_e, enabled: boolean) => {
    setTracking(enabled);
    return { ok: true, enabled };
  });

  ipcMain.handle(IPC.getTracking, () => trayController.isTrackingEnabled());
  ipcMain.handle(IPC.getSettings, () => settings);
  ipcMain.handle(IPC.saveSettings, (_e, next: Settings) => {
    settings = next;
    repo.saveSettings(next);
    return { ok: true };
  });
}

function startSchedulers(): void {
  const checkInPrompts = new CheckInPromptScheduler(settings.checkInTimes, () => {
    openCheckIn();
  });
  checkInPrompts.start();

  const endOfDay = new DailyTrigger(settings.endOfDayTime, () => {
    showDailySummaryNotification();
  });
  endOfDay.start();
}

function createTrayIcon(): void {
  // A 1x1 transparent placeholder keeps the app runnable without a bundled asset.
  const image = nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip('Productivity Dashboard');
  tray.setContextMenu(buildTrayMenu());
  trayController.showIcon();
}

app.whenReady?.().then(() => {
  const initResult = repo.init();
  settings = repo.getSettings();

  trackerService = new TimeTrackerService(
    repo,
    {
      getActiveWindow,
      getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    },
    settings.idleThresholdSeconds,
    settings.pollIntervalSeconds
  );
  trackerService.start();
  // Requirement 8.5: tracking starts disabled regardless of prior state.
  trackerService.setEnabled(false);

  registerIpcHandlers();
  createTrayIcon();
  startSchedulers();

  if (initResult === 'no-persistence' && Notification.isSupported()) {
    new Notification({
      title: 'Productivity Dashboard',
      body: 'Storage is unavailable — data will not be saved this session.',
    }).show();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openDashboard();
  });
});

// Keep running in the tray when all windows are closed.
app.on('window-all-closed', () => {
  // Intentionally do not quit; this is a tray app.
});

app.on('before-quit', () => {
  trackerService?.stop();
  repo.close();
});
