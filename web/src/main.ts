/**
 * Web app entry point.
 *
 * Wires the DOM to the shared pure domain core (categorizer, task validation,
 * check-in scheduler, aggregator, insight engine) and the browser-side store
 * and tracker. No framework — just typed DOM wiring, mirroring the desktop
 * renderer but reusing the same `@core` logic.
 */

import './styles.css';
import { WebStore } from './store';
import { WebTracker } from './tracker';

import { isValidDescription } from '@core/taskLogger';
import { DefaultCheckInScheduler } from '@core/checkInScheduler';
import { timeByCategory, weeklyFigures } from '@core/aggregator';
import { generate } from '@core/insightEngine';
import { categorize, applyRulesToRecords } from '@core/categorizer';
import {
  ActivityRecord,
  Category,
  CategoryRule,
  DateRange,
  PeriodData,
} from '@shared/types';

const store = new WebStore();
const checkInScheduler = new DefaultCheckInScheduler();
const CATEGORY_ORDER: Category[] = ['Work', 'Break', 'Distraction', 'Uncategorized'];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}
const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

// --------------------------------------------------------------------------
// Tabs
// --------------------------------------------------------------------------
function wireTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab!;
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      $(`tab-${name}`).classList.add('active');
      if (name === 'dashboard') void refreshDashboard();
      if (name === 'data') void renderRules();
    });
  });
}

// --------------------------------------------------------------------------
// Tracker
// --------------------------------------------------------------------------
const tracker = new WebTracker({
  onTick: ({ elapsedSeconds, label, idle, running }) => {
    $('track-elapsed').textContent = formatClock(elapsedSeconds);
    $('track-current').textContent = running && label ? `· ${label}` : '';
    $('track-idle').classList.toggle('hidden', !idle);
    ($('track-start') as HTMLButtonElement).disabled = running;
    ($('track-stop') as HTMLButtonElement).disabled = !running;
  },
  onComplete: async (record: ActivityRecord) => {
    const rules = await store.getCategoryRules();
    const ruled = categorize(record.appName, rules);
    const category = ruled === 'Uncategorized' ? record.category : ruled;
    await store.saveActivity({ ...record, category });
  },
});

function wireTracker(): void {
  $('track-start').addEventListener('click', () => {
    const label = ($('track-label') as HTMLInputElement).value;
    const category = ($('track-category') as HTMLSelectElement).value as ActivityRecord['category'];
    tracker.start(label, category);
  });
  $('track-stop').addEventListener('click', () => void tracker.stop());

  const idleToggle = $('idle-toggle') as HTMLInputElement;
  idleToggle.addEventListener('change', async () => {
    const res = await tracker.setIdleAutoPause(idleToggle.checked);
    $('idle-note').textContent = res.message;
    if (!res.ok) idleToggle.checked = false;
  });
}

// --------------------------------------------------------------------------
// Tasks
// --------------------------------------------------------------------------
async function renderTasks(): Promise<void> {
  const tasks = await store.queryTasks(fullRange());
  const list = $('task-list');
  list.innerHTML = '';
  if (tasks.length === 0) {
    list.innerHTML = '<li class="muted">No tasks yet.</li>';
    return;
  }
  for (const task of [...tasks].reverse()) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<div>${escapeHtml(task.description)}</div><div class="ts">${new Date(task.timestamp).toLocaleString()}</div>`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      await store.deleteTask(task.id);
      void renderTasks();
    });
    li.append(left, del);
    list.appendChild(li);
  }
}

function wireTaskForm(): void {
  const form = $('task-form') as HTMLFormElement;
  const input = $('task-input') as HTMLInputElement;
  const error = $('task-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    if (!isValidDescription(input.value)) {
      error.textContent = 'Task description cannot be empty.';
      return;
    }
    await store.saveTask({
      id: genId(),
      description: input.value,
      timestamp: new Date().toISOString(),
    });
    input.value = '';
    void renderTasks();
  });
}

// --------------------------------------------------------------------------
// Check-in modal
// --------------------------------------------------------------------------
const selected: Record<string, number> = { energy: 0, focus: 0 };

function buildRating(containerId: string, name: string): void {
  const container = $(containerId);
  container.innerHTML = '';
  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(i);
    btn.addEventListener('click', () => {
      selected[name] = i;
      Array.from(container.children).forEach((child, idx) =>
        child.classList.toggle('selected', idx < i)
      );
    });
    container.appendChild(btn);
  }
}

function openCheckIn(): void {
  selected.energy = 0;
  selected.focus = 0;
  buildRating('energy-rating', 'energy');
  buildRating('focus-rating', 'focus');
  $('checkin-modal').classList.remove('hidden');
}

function wireCheckIn(): void {
  $('open-checkin').addEventListener('click', openCheckIn);
  $('checkin-dismiss').addEventListener('click', () => {
    $('checkin-modal').classList.add('hidden');
  });
  $('checkin-submit').addEventListener('click', async () => {
    const entry = checkInScheduler.onSubmit(
      selected.energy || 3,
      selected.focus || 3,
      new Date()
    );
    await store.saveCheckIn(entry);
    $('checkin-modal').classList.add('hidden');
    $('checkin-status').textContent = `Last check-in: energy ${entry.energy}/5, focus ${entry.focus}/5`;
  });
}

// --------------------------------------------------------------------------
// Category rules (Data tab)
// --------------------------------------------------------------------------
async function renderRules(): Promise<void> {
  const rules = await store.getCategoryRules();
  const list = $('rule-list');
  list.innerHTML = '';
  if (rules.length === 0) {
    list.innerHTML = '<li class="muted">No rules yet.</li>';
    return;
  }
  for (const rule of rules) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${rule.appName} → ${rule.category}`;
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      await store.deleteCategoryRule(rule.appName);
      await reapplyRules();
      void renderRules();
    });
    li.append(label, del);
    list.appendChild(li);
  }
}

/** Re-derive every stored activity's category from the current rule set. */
async function reapplyRules(): Promise<void> {
  const rules = await store.getCategoryRules();
  const activities = await store.queryActivities(fullRange());
  const updated = applyRulesToRecords(activities, rules);
  for (const r of updated) await store.updateActivityCategory(r.id, r.category);
}

function wireRuleForm(): void {
  const form = $('rule-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const app = ($('rule-app') as HTMLInputElement).value.trim();
    if (!app) return;
    const category = ($('rule-category') as HTMLSelectElement).value as CategoryRule['category'];
    await store.setCategoryRule({ appName: app, category });
    await reapplyRules();
    ($('rule-app') as HTMLInputElement).value = '';
    void renderRules();
  });
}

// --------------------------------------------------------------------------
// Data export / import / delete
// --------------------------------------------------------------------------
function wireDataControls(): void {
  $('export-btn').addEventListener('click', async () => {
    const json = await store.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-export-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    $('data-status').textContent = 'Exported.';
  });

  const fileInput = $('import-file') as HTMLInputElement;
  $('import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    await store.importJson(text);
    $('data-status').textContent = 'Imported.';
    await Promise.all([renderTasks(), renderRules(), refreshDashboard()]);
  });

  $('delete-all-btn').addEventListener('click', async () => {
    if (!confirm('Delete ALL local data? This cannot be undone.')) return;
    await store.deleteAll();
    $('data-status').textContent = 'All data deleted.';
    await Promise.all([renderTasks(), renderRules(), refreshDashboard()]);
  });
}

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------
function fullRange(): DateRange {
  return { start: '0000-01-01', end: '9999-12-31' };
}
function currentRange(): DateRange {
  const start = ($('range-start') as HTMLInputElement).value || daysAgoIso(6);
  const end = ($('range-end') as HTMLInputElement).value || todayIso();
  return { start, end };
}

async function refreshDashboard(): Promise<void> {
  const range = currentRange();
  const [activities, tasks, checkIns] = await Promise.all([
    store.queryActivities(range),
    store.queryTasks(range),
    store.queryCheckIns(range),
  ]);
  const period: PeriodData = { range, activities, tasks, checkIns };

  renderTimeByCategory(timeByCategory(activities, range));
  renderWellbeing(weeklyFigures(range, period));
  renderInsights(generate(period));
  renderDashTasks(tasks);
}

function renderTimeByCategory(map: Record<Category, number>): void {
  const container = $('time-by-category');
  container.innerHTML = '';
  const max = Math.max(1, ...Object.values(map));
  for (const category of CATEGORY_ORDER) {
    const seconds = map[category] ?? 0;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span>${category}</span>
      <span class="bar-track"><span class="bar-fill ${category}" style="width:${(seconds / max) * 100}%"></span></span>
      <span>${formatHM(seconds)}</span>`;
    container.appendChild(row);
  }
}

function renderWellbeing(figures: { energyTrend: number[]; focusTrend: number[] }): void {
  const canvas = $('wellbeing-chart') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#2a3340';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  const draw = (series: number[], color: string) => {
    if (series.length === 0) return;
    const pad = 24;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((value, i) => {
      const x = pad + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
      const y = pad + h - (Math.max(0, Math.min(5, value)) / 5) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  draw(figures.energyTrend, '#4c8bf5');
  draw(figures.focusTrend, '#3fb950');
}

function renderInsights(insights: string[]): void {
  const list = $('insights-list');
  list.innerHTML = '';
  for (const insight of insights) {
    const li = document.createElement('li');
    li.textContent = insight;
    list.appendChild(li);
  }
}

function renderDashTasks(tasks: { id: string; description: string; timestamp: string }[]): void {
  const list = $('dash-task-list');
  list.innerHTML = '';
  if (tasks.length === 0) {
    list.innerHTML = '<li class="muted">No tasks in this range.</li>';
    return;
  }
  for (const task of [...tasks].reverse()) {
    const li = document.createElement('li');
    li.innerHTML = `<div>${escapeHtml(task.description)}</div><div class="ts">${new Date(task.timestamp).toLocaleDateString()}</div>`;
    list.appendChild(li);
  }
}

function wireRangeControls(): void {
  ($('range-start') as HTMLInputElement).value = daysAgoIso(6);
  ($('range-end') as HTMLInputElement).value = todayIso();
  $('apply-range').addEventListener('click', () => void refreshDashboard());
  $('range-week').addEventListener('click', () => {
    ($('range-start') as HTMLInputElement).value = daysAgoIso(6);
    ($('range-end') as HTMLInputElement).value = todayIso();
    void refreshDashboard();
  });
}

// --------------------------------------------------------------------------
// Bootstrap
// --------------------------------------------------------------------------
async function main(): Promise<void> {
  await store.init();
  wireTabs();
  wireTracker();
  wireTaskForm();
  wireCheckIn();
  wireRuleForm();
  wireDataControls();
  wireRangeControls();
  await renderTasks();
}

void main();
