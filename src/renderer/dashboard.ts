/**
 * Dashboard renderer (Requirement 7, 3, 9.2, 9.3).
 *
 * Renders time-by-category, the task list, and energy/focus ratings for a
 * user-selected date range, re-requesting aggregated data when the range
 * changes. Also hosts the task entry form and the export / delete-all controls.
 * All data flows through the preload bridge (window.dashboard) over IPC.
 */

const CATEGORY_ORDER = ['Work', 'Break', 'Distraction', 'Uncategorized'];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function renderTimeByCategory(data: DashboardData): void {
  const container = $('time-by-category');
  container.innerHTML = '';
  const max = Math.max(1, ...Object.values(data.timeByCategory));
  for (const category of CATEGORY_ORDER) {
    const seconds = data.timeByCategory[category] ?? 0;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span>${category}</span>
      <span class="bar-track">
        <span class="bar-fill ${category}" style="width:${(seconds / max) * 100}%"></span>
      </span>
      <span>${formatHours(seconds)}</span>`;
    container.appendChild(row);
  }
}

function renderTasks(data: DashboardData): void {
  const list = $('task-list');
  list.innerHTML = '';
  if (data.tasks.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No tasks logged in this range.';
    list.appendChild(li);
    return;
  }
  for (const task of data.tasks) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<div>${escapeHtml(task.description)}</div><div class="ts">${new Date(task.timestamp).toLocaleString()}</div>`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      await window.dashboard.deleteTask(task.id);
      void refresh();
    });
    li.appendChild(left);
    li.appendChild(del);
    list.appendChild(li);
  }
}

function renderWellbeing(data: DashboardData): void {
  const canvas = $('wellbeing-chart') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawSeries = (series: number[], color: string) => {
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
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Axis baseline
  ctx.strokeStyle = '#2a3340';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  drawSeries(data.energyTrend, '#4c8bf5');
  drawSeries(data.focusTrend, '#3fb950');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

async function refresh(): Promise<void> {
  const start = ($('range-start') as HTMLInputElement).value || daysAgoIso(6);
  const end = ($('range-end') as HTMLInputElement).value || todayIso();
  const data = await window.dashboard.getDashboardData(start, end);
  renderTimeByCategory(data);
  renderTasks(data);
  renderWellbeing(data);

  const report = await window.dashboard.getWeeklyReport(end);
  const list = $('insights-list');
  list.innerHTML = '';
  for (const insight of report.insights) {
    const li = document.createElement('li');
    li.textContent = insight;
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
    const result = await window.dashboard.addTask(input.value);
    if (!result.ok) {
      error.textContent = result.error ?? 'Could not add task.';
      return;
    }
    input.value = '';
    void refresh();
  });
}

function wireTrackingToggle(): void {
  const toggle = $('tracking-toggle') as HTMLInputElement;
  const label = $('tracking-label');
  const setLabel = (on: boolean) => {
    label.textContent = on ? 'Tracking on' : 'Tracking off';
    toggle.checked = on;
  };
  toggle.addEventListener('change', async () => {
    const res = await window.dashboard.setTracking(toggle.checked);
    setLabel(res.enabled);
  });
  window.dashboard.onTrackingChanged((enabled) => setLabel(enabled));
  void window.dashboard.getTracking().then(setLabel);
}

function wireRangeControls(): void {
  ($('range-start') as HTMLInputElement).value = daysAgoIso(6);
  ($('range-end') as HTMLInputElement).value = todayIso();
  $('apply-range').addEventListener('click', () => void refresh());
}

function wireDataControls(): void {
  $('export-btn').addEventListener('click', async () => {
    const res = await window.dashboard.exportData();
    if (res.ok && res.filePath) alert(`Exported to ${res.filePath}`);
  });
  $('delete-all-btn').addEventListener('click', async () => {
    if (confirm('Delete ALL stored data? This cannot be undone.')) {
      await window.dashboard.deleteAllData();
      void refresh();
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  wireTaskForm();
  wireTrackingToggle();
  wireRangeControls();
  wireDataControls();
  void refresh();
});
