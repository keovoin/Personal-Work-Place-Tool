/**
 * Preload script: exposes a minimal, typed bridge to the renderer over IPC.
 * The renderer never gets direct Node/Electron access (contextIsolation on).
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';

const api = {
  addTask: (description: string) => ipcRenderer.invoke(IPC.addTask, description),
  editTask: (id: string, description: string) =>
    ipcRenderer.invoke(IPC.editTask, id, description),
  deleteTask: (id: string) => ipcRenderer.invoke(IPC.deleteTask, id),
  submitCheckIn: (energy: number, focus: number) =>
    ipcRenderer.invoke(IPC.submitCheckIn, energy, focus),
  dismissCheckIn: () => ipcRenderer.invoke(IPC.dismissCheckIn),
  getDashboardData: (start: string, end: string) =>
    ipcRenderer.invoke(IPC.getDashboardData, start, end),
  getWeeklyReport: (endDay: string) =>
    ipcRenderer.invoke(IPC.getWeeklyReport, endDay),
  setCategoryRule: (appName: string, category: string) =>
    ipcRenderer.invoke(IPC.setCategoryRule, appName, category),
  setActivityCategory: (id: string, category: string) =>
    ipcRenderer.invoke(IPC.setActivityCategory, id, category),
  exportData: () => ipcRenderer.invoke(IPC.exportData),
  deleteAllData: () => ipcRenderer.invoke(IPC.deleteAllData),
  setTracking: (enabled: boolean) =>
    ipcRenderer.invoke(IPC.setTracking, enabled),
  getTracking: () => ipcRenderer.invoke(IPC.getTracking),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (settings: unknown) =>
    ipcRenderer.invoke(IPC.saveSettings, settings),

  onShowCheckInPrompt: (cb: () => void) =>
    ipcRenderer.on(IPC.showCheckInPrompt, () => cb()),
  onTrackingChanged: (cb: (enabled: boolean) => void) =>
    ipcRenderer.on(IPC.trackingChanged, (_e, enabled: boolean) => cb(enabled)),
};

contextBridge.exposeInMainWorld('dashboard', api);

export type DashboardApi = typeof api;
