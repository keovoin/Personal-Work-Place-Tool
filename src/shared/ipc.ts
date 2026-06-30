/**
 * IPC channel names shared between the Electron main process and the renderer.
 * Centralized so both sides stay in sync.
 */

export const IPC = {
  // Renderer -> Main (invoke/handle)
  addTask: 'task:add',
  editTask: 'task:edit',
  deleteTask: 'task:delete',
  submitCheckIn: 'checkin:submit',
  dismissCheckIn: 'checkin:dismiss',
  getDashboardData: 'dashboard:get',
  getWeeklyReport: 'report:weekly',
  setCategoryRule: 'category:setRule',
  setActivityCategory: 'category:setActivity',
  exportData: 'data:export',
  deleteAllData: 'data:deleteAll',
  setTracking: 'tracking:set',
  getTracking: 'tracking:get',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',

  // Main -> Renderer (send)
  showCheckInPrompt: 'checkin:prompt',
  openDashboard: 'dashboard:open',
  openTaskEntry: 'task:open',
  trackingChanged: 'tracking:changed',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Shape of dashboard data returned to the renderer. */
export interface DashboardData {
  range: { start: string; end: string };
  timeByCategory: Record<string, number>;
  tasks: Array<{ id: string; description: string; timestamp: string }>;
  energyTrend: number[];
  focusTrend: number[];
  days: string[];
}
