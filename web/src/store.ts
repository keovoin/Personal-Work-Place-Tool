/**
 * IndexedDB storage layer — the web replacement for the desktop SqliteRepository.
 *
 * The pure domain core operates on plain arrays, so this store only needs to
 * persist and load those arrays. Everything lives in the browser; nothing is
 * uploaded. Data volumes for a personal tool are tiny, so range filtering is
 * done in memory with the shared `isInRange` helper.
 */

import { openDB, type IDBPDatabase } from 'idb';
import {
  ActivityRecord,
  CategoryRule,
  CheckInEntry,
  Dataset,
  DEFAULT_SETTINGS,
  Settings,
  TaskEntry,
  Category,
  DateRange,
} from '@shared/types';
import { isInRange } from '@core/dates';
import { serialize, deserialize } from '../../src/data/serializer';

const DB_NAME = 'productivity-dashboard';
const DB_VERSION = 1;

type StoreName = 'activities' | 'tasks' | 'checkIns' | 'rules' | 'meta';

export class WebStore {
  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('activities'))
          db.createObjectStore('activities', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tasks'))
          db.createObjectStore('tasks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('checkIns'))
          db.createObjectStore('checkIns', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('rules'))
          db.createObjectStore('rules', { keyPath: 'appName' });
        if (!db.objectStoreNames.contains('meta'))
          db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }

  private get database(): IDBPDatabase {
    if (!this.db) throw new Error('Store not initialized');
    return this.db;
  }

  private async getAll<T>(store: StoreName): Promise<T[]> {
    return (await this.database.getAll(store)) as T[];
  }

  // --- writes ---
  async saveActivity(r: ActivityRecord): Promise<void> {
    await this.database.put('activities', r);
  }
  async saveTask(t: TaskEntry): Promise<void> {
    await this.database.put('tasks', t);
  }
  async saveCheckIn(c: CheckInEntry): Promise<void> {
    await this.database.put('checkIns', c);
  }
  async updateActivityCategory(id: string, category: Category): Promise<void> {
    const rec = (await this.database.get('activities', id)) as
      | ActivityRecord
      | undefined;
    if (rec) await this.database.put('activities', { ...rec, category });
  }
  async setCategoryRule(rule: CategoryRule): Promise<void> {
    await this.database.put('rules', {
      appName: rule.appName.toLowerCase(),
      category: rule.category,
    });
  }
  async deleteCategoryRule(appName: string): Promise<void> {
    await this.database.delete('rules', appName.toLowerCase());
  }
  async deleteTask(id: string): Promise<void> {
    await this.database.delete('tasks', id);
  }
  async updateTask(id: string, description: string): Promise<void> {
    const rec = (await this.database.get('tasks', id)) as TaskEntry | undefined;
    if (rec) await this.database.put('tasks', { ...rec, description });
  }

  // --- reads ---
  async getCategoryRules(): Promise<CategoryRule[]> {
    return this.getAll<CategoryRule>('rules');
  }
  async queryActivities(range: DateRange): Promise<ActivityRecord[]> {
    const all = await this.getAll<ActivityRecord>('activities');
    return all
      .filter((r) => isInRange(r.startTime, range))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  async queryTasks(range: DateRange): Promise<TaskEntry[]> {
    const all = await this.getAll<TaskEntry>('tasks');
    return all
      .filter((t) => isInRange(t.timestamp, range))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  async queryCheckIns(range: DateRange): Promise<CheckInEntry[]> {
    const all = await this.getAll<CheckInEntry>('checkIns');
    return all
      .filter((c) => isInRange(c.timestamp, range))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async getSettings(): Promise<Settings> {
    const row = (await this.database.get('meta', 'settings')) as
      | { key: string; value: Settings }
      | undefined;
    return row ? { ...DEFAULT_SETTINGS, ...row.value } : DEFAULT_SETTINGS;
  }
  async saveSettings(settings: Settings): Promise<void> {
    await this.database.put('meta', { key: 'settings', value: settings });
  }

  // --- whole-dataset ops ---
  async loadDataset(): Promise<Dataset> {
    return {
      activities: await this.getAll<ActivityRecord>('activities'),
      tasks: await this.getAll<TaskEntry>('tasks'),
      checkIns: await this.getAll<CheckInEntry>('checkIns'),
      rules: await this.getCategoryRules(),
      settings: await this.getSettings(),
    };
  }

  /** Serializes the full dataset to a JSON string (reuses the shared serializer). */
  async exportJson(): Promise<string> {
    return serialize(await this.loadDataset(), new Date().toISOString());
  }

  /** Replaces all stored data with the contents of an exported JSON string. */
  async importJson(json: string): Promise<void> {
    const dataset = deserialize(json);
    await this.deleteAll();
    for (const a of dataset.activities) await this.saveActivity(a);
    for (const t of dataset.tasks) await this.saveTask(t);
    for (const c of dataset.checkIns) await this.saveCheckIn(c);
    for (const r of dataset.rules) await this.setCategoryRule(r);
    await this.saveSettings(dataset.settings);
  }

  async deleteAll(): Promise<void> {
    await this.database.clear('activities');
    await this.database.clear('tasks');
    await this.database.clear('checkIns');
    await this.database.clear('rules');
  }
}
