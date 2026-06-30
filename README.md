# Hybrid Productivity Dashboard

A privacy-focused, **offline-first** productivity tool that tracks how you spend
your time, lets you log tasks and record quick energy & focus check-ins, and
turns it all into a daily summary plus a weekly report with locally-generated
insights.

It ships in **two forms** that share the same pure domain logic:

- 🖥️ **Desktop app (Electron)** — lives in your system tray and tracks the
  active window **automatically**. Data is stored in a local SQLite file.
- 🌐 **Web app / PWA (`web/`)** — runs in any browser, installable and offline,
  with **manual** time tracking. Data is stored in the browser (IndexedDB).
  Deployable for free to GitHub Pages / Vercel / Netlify / Cloudflare.

> **Privacy by design:** every feature works offline and all data stays on your
> device — local SQLite file (desktop) or IndexedDB (web). No account, no
> network calls, no telemetry.

> **Origin:** this project was built from the specification documents in the
> repo root — [`requirements (2).md`](<requirements (2).md>),
> [`design (2).md`](<design (2).md>), and [`tasks (2).md`](<tasks (2).md>).

---

## Two ways to run it — at a glance

| | Desktop (Electron) | Web / PWA (`web/`) |
|---|---|---|
| **Time tracking** | Automatic (active-window polling) | Manual start/stop timer |
| **Storage** | SQLite (`better-sqlite3`) | IndexedDB (`idb`) |
| **Idle handling** | System idle via `powerMonitor` | Optional Idle Detection API |
| **Install** | Build/launch locally (`npm start`) | Open a URL; installable PWA |
| **Best when** | You want hands-off, automatic tracking | You want to open it anywhere, no install |

Jump to: [Desktop quick start](#getting-started) · [Web app & hosting](#web-app-hosted-no-install--web)

---

## Features

| Area | What it does |
|------|--------------|
| **Automatic time tracking** | Polls the active OS window (≤ 5s) and accumulates active time per app/window. Splits records when you switch windows. |
| **Idle detection** | Uses system idle time; once you're idle past a threshold (default 5 min) the current record stops accumulating and is flagged idle. |
| **Categorization** | Map apps to `Work` / `Break` / `Distraction` with rules (case-insensitive). Rules re-apply to existing records; anything unmatched is `Uncategorized`. |
| **Task logging** | Add/edit/delete completed tasks. Empty/whitespace-only entries are rejected. |
| **Energy & focus check-ins** | Three configurable daily prompts (1–5 scale). Dismissed prompts are reissued once after 30 minutes. Ratings are clamped to 1–5. |
| **Daily summary** | An end-of-day notification with time-by-category, task count, and average energy/focus. |
| **Weekly report** | Aggregated figures + trends + at least one insight (with an explicit "insufficient data" note when there's < 2 days of data). |
| **Dashboard** | Pick a date range to view time-by-category, an energy/focus chart, insights, and your task list. |
| **Data ownership** | Export everything to JSON, or delete all data. Robust startup recovery for missing/corrupted stores. |
| **Tray control** | Tracking is **off by default on every launch**; toggle it from the tray. |

---

## Architecture

The codebase follows a **pure core / thin shell** design so the logic is
testable and platform-independent.

```
.
├─ requirements (2).md / design (2).md / tasks (2).md   # the original spec
├─ src/
│  ├─ shared/        # Types, component interfaces, IPC channel names
│  ├─ core/          # Pure domain logic (no Electron, no I/O)
│  │   ├─ timeTracker.ts      # accumulate / split / idle step function
│  │   ├─ categorizer.ts      # rule resolution + bulk re-categorization
│  │   ├─ taskLogger.ts       # validation + add/edit/delete
│  │   ├─ checkInScheduler.ts # prompts, reissue, rating clamp
│  │   ├─ aggregator.ts       # daily summary, weekly figures, range grouping
│  │   ├─ insightEngine.ts    # local insight generation
│  │   ├─ reports.ts          # composes figures + insights
│  │   └─ dates.ts            # calendar-day helpers (UTC)
│  ├─ data/          # Persistence
│  │   ├─ repository.ts       # SQLite (better-sqlite3) + startup recovery
│  │   └─ serializer.ts       # pure export/import (round-trip safe)
│  ├─ main/          # Electron main process (the desktop "shell")
│  │   ├─ main.ts             # app wiring: repo, tray, IPC, schedulers
│  │   ├─ trayController.ts   # tray menu + tracking flag
│  │   ├─ timeTrackerService.ts # drives the pure poll loop
│  │   ├─ schedulers.ts       # check-in / end-of-day timers
│  │   ├─ notifications.ts    # daily-summary notification formatting
│  │   └─ preload.ts          # context-isolated IPC bridge
│  └─ renderer/      # Desktop UI (HTML/CSS/TS)
├─ web/              # Web/PWA shell — reuses ../src/core & ../src/shared
│  ├─ src/store.ts            # IndexedDB storage (idb)
│  ├─ src/tracker.ts          # manual tracker (reuses pure pollStep)
│  ├─ src/main.ts             # UI wiring (tabs, dashboard, check-in)
│  └─ vite.config.ts          # Vite + PWA + @core/@shared aliases
├─ test/             # Vitest unit + property-based tests
└─ .github/workflows/deploy-web.yml   # GitHub Pages deploy for web/
```

**Why this matters:** all behavior lives in `core/` as side-effect-free
functions, so it's covered by property-based tests and reusable in a different
shell — which is exactly how the [web app](#web-app-hosted-no-install--web)
reuses it.

### Tech stack
- **Electron** (desktop shell, tray, notifications)
- **TypeScript** (strict)
- **better-sqlite3** (local storage)
- **active-win** (active window) + Electron `powerMonitor` (idle time)
- **Vitest** + **fast-check** (unit + property-based tests)

---

## Getting started

> Requires **Node.js 18+** (developed on Node 22).

```bash
# install dependencies
npm install

# run the test suite
npm test

# type-check everything
npm run typecheck

# build main + renderer
npm run build:all

# launch the desktop app
npm start
```

### NPM scripts
| Script | Purpose |
|--------|---------|
| `npm test` | Run all tests once (Vitest). |
| `npm run test:watch` | Watch mode. |
| `npm run typecheck` | Type-check main + renderer without emitting. |
| `npm run build` | Compile the main/core/data sources. |
| `npm run build:renderer` | Compile the renderer and copy HTML/CSS. |
| `npm run build:all` | Build everything. |
| `npm start` | Build then launch Electron. |

---

## Testing

`npm test` runs **48 tests**, including **21 property-based tests** (one per
behavioral property in the design doc, tagged
`// Feature: productivity-dashboard, Property N`), plus unit tests, integration
tests, and an offline/local-only smoke test that statically verifies no network
client is wired into `core` / `data` / `main`.

---

## Data & privacy

- Data is stored in a local SQLite file under Electron's `userData` directory.
- **Export** writes a single JSON file you fully control.
- **Delete all data** wipes activities, tasks, check-ins, and rules.
- Startup recovery: a missing store is created, a corrupted store is backed up
  (`*.corrupt-<timestamp>.bak`) and recreated, and if storage can't be created
  the app runs in memory-only mode for the session.

---

## Web app (hosted, no install) — `web/`

A **browser-based PWA** version lives in [`web/`](web/). It reuses the exact same
pure domain core (`src/core`) as the desktop app, so categorization, task
validation, check-in scheduling, aggregation, and insights behave identically.
Only the "shell" differs:

| Concern | Desktop (Electron) | Web (`web/`) |
|---------|--------------------|--------------|
| Storage | SQLite (`better-sqlite3`) | **IndexedDB** (via `idb`) |
| Time tracking | **Automatic** active-window polling | **Manual** start/stop timer (label + category) |
| Idle | `powerMonitor` system idle | Optional [Idle Detection API](https://developer.mozilla.org/docs/Web/API/Idle_Detection_API) auto-pause (Chromium) |
| Hosting | Download / install | Any static host; installable PWA, works offline |

> **Why manual tracking?** A browser tab can't see which *other* application
> you're using, so the web version asks you to name what you're working on and
> press Start. The underlying accumulate/split/idle logic is the same pure
> `pollStep` function used by the desktop app.

### Run the web app locally
```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into web/dist
npm run preview  # preview the production build
```

### Deploy it for free (pick one)

**GitHub Pages (zero config, in-repo)** — a workflow is included at
[`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml):
1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the workflow manually). It builds `web/` and publishes it.
3. Your app goes live at `https://<your-username>.github.io/Personal-Work-Place-Tool/`.

**Vercel** — Import the repo, set **Root Directory = `web`**. Config is in
[`web/vercel.json`](web/vercel.json) (builds with `BASE_PATH=/`).

**Netlify** — "Add new site" → import repo. Config is in
[`web/netlify.toml`](web/netlify.toml) (base directory `web`, publish `dist`).

**Cloudflare Pages** — Framework preset **Vite**, root directory `web`, build
command `BASE_PATH=/ npm run build`, output `dist`.

> The base path defaults to `/Personal-Work-Place-Tool/` for GitHub Pages. For
> root-domain hosts (Vercel/Netlify/Cloudflare) the provided configs set
> `BASE_PATH=/` so assets resolve correctly.

### Privacy (web)
All data stays in your browser's IndexedDB — nothing is uploaded. Use the
**Data** tab to export/import JSON or delete everything.

---

## Other ways to take it online

If the web app's *manual* tracking isn't enough and you need automatic
OS-level tracking while still accessing data online, these remain options:

- **Distribute the desktop app:** publish installers via
  [`electron-builder`](https://www.electron.build/) + GitHub Releases, with
  `electron-updater` for auto-updates. Keeps full automatic tracking, no servers.
- **Hybrid (local agent + hosted dashboard):** a small local tracker syncs
  records to a hosted backend ([Supabase](https://supabase.com),
  [Firebase](https://firebase.google.com), [Neon](https://neon.tech)) with a web
  dashboard you open anywhere. Preserves automatic tracking, but data leaves the
  device — add auth + encryption.
- **Cloud sync only:** keep the desktop tracker and back up the exported JSON to
  cloud storage so you can view/restore it elsewhere.

