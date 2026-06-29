/** Ambient type for the preload-exposed API on `window.dashboard`. */

interface DashboardData {
  range: { start: string; end: string };
  timeByCategory: Record<string, number>;
  tasks: Array<{ id: string; description: string; timestamp: string }>;
  energyTrend: number[];
  focusTrend: number[];
  days: string[];
}

interface WeeklyReportData {
  startDate: string;
  endDate: string;
  timeByCategory: Record<string, number>;
  completedTaskCount: number;
  energyTrend: number[];
  focusTrend: number[];
  insights: string[];
}

interface DashboardApi {
  addTask(description: string): Promise<{ ok: boolean; error?: string; task?: unknown }>;
  editTask(id: string, description: string): Promise<{ ok: boolean; error?: string }>;
  deleteTask(id: string): Promise<{ ok: boolean }>;
  submitCheckIn(energy: number, focus: number): Promise<{ ok: boolean }>;
  dismissCheckIn(): Promise<{ ok: boolean }>;
  getDashboardData(start: string, end: string): Promise<DashboardData>;
  getWeeklyReport(endDay: string): Promise<WeeklyReportData>;
  setCategoryRule(appName: string, category: string): Promise<{ ok: boolean }>;
  setActivityCategory(id: string, category: string): Promise<{ ok: boolean }>;
  exportData(): Promise<{ ok: boolean; filePath?: string; error?: string }>;
  deleteAllData(): Promise<{ ok: boolean }>;
  setTracking(enabled: boolean): Promise<{ ok: boolean; enabled: boolean }>;
  getTracking(): Promise<boolean>;
  getSettings(): Promise<unknown>;
  saveSettings(settings: unknown): Promise<{ ok: boolean }>;
  onShowCheckInPrompt(cb: () => void): void;
  onTrackingChanged(cb: (enabled: boolean) => void): void;
}

interface Window {
  dashboard: DashboardApi;
}
