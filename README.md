# Hybrid Productivity Dashboard

A privacy-focused, **offline-first** desktop productivity tool. It lives in your
system tray, automatically tracks which application/window is active, lets you
categorize that time, log completed tasks, record quick energy & focus
check-ins, and turns all of it into a daily summary and a weekly report with
locally-generated insights.

> **Privacy by design:** every feature works offline and all data stays on your
> device in a local SQLite file. No account, no network calls, no telemetry.

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
src/
├─ shared/        # Types, component interfaces, IPC channel names
├─ core/          # Pure domain logic (no Electron, no I/O)
│   ├─ timeTracker.ts      # accumulate / split / idle step function
│   ├─ categorizer.ts      # rule resolution + bulk re-categorization
│   ├─ taskLogger.ts       # validation + add/edit/delete
│   ├─ checkInScheduler.ts # prompts, reissue, rating clamp
│   ├─ aggregator.ts       # daily summary, weekly figures, range grouping
│   ├─ insightEngine.ts    # local insight generation
│   ├─ reports.ts          # composes figures + insights
│   └─ dates.ts            # calendar-day helpers (UTC)
├─ data/          # Persistence
│   ├─ repository.ts       # SQLite (better-sqlite3) + startup recovery
│   └─ serializer.ts       # pure export/import (round-trip safe)
├─ main/          # Electron main process (the "shell")
│   ├─ main.ts             # app wiring: repo, tray, IPC, schedulers
│   ├─ trayController.ts   # tray menu + tracking flag
│   ├─ timeTrackerService.ts # drives the pure poll loop
│   ├─ schedulers.ts       # check-in / end-of-day timers
│   ├─ notifications.ts    # daily-summary notification formatting
│   └─ preload.ts          # context-isolated IPC bridge
└─ renderer/      # UI (HTML/CSS/TS)
    ├─ index.html / dashboard.ts  # dashboard
    └─ checkin.html / checkin.ts  # check-in prompt
```

**Why this matters:** all behavior lives in `core/` as side-effect-free
functions, so it's covered by property-based tests and is reusable in a
different shell (for example, a web version — see *Running it online* below).

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

## Running it online (alternatives to local hosting)

This app is a **desktop application by necessity**: its headline feature —
*automatic* tracking of the active OS window and system idle time — needs
native OS access that a website running in a browser sandbox cannot have. So
there is no way to take the current app as-is and "host it online" like a
typical web app. There are, however, several legitimate paths depending on what
you actually want:

### 1. Distribute the desktop app (recommended, no servers)
You don't host it — you publish installers and users download them. Use
[`electron-builder`](https://www.electron.build/) to produce Windows/macOS/Linux
binaries and attach them to **GitHub Releases** (free). Add auto-update via
`electron-updater`. This keeps the full automatic-tracking feature set.

### 2. Build a hosted web/PWA version (drop or relax auto-tracking)
Because the domain logic in `src/core` is pure and shell-independent, it can be
reused in a browser app. You'd swap the "shell":
- **Storage:** SQLite/`better-sqlite3` → `IndexedDB` (or `sql.js` in the browser).
- **Tracking:** automatic OS window tracking → **manual** start/stop timers,
  plus the browser [Page Visibility API](https://developer.mozilla.org/docs/Web/API/Page_Visibility_API)
  and the experimental [Idle Detection API](https://developer.mozilla.org/docs/Web/API/Idle_Detection_API)
  for rough activity/idle signals.
- **Host it for free** on **Vercel**, **Netlify**, **Cloudflare Pages**, or
  **GitHub Pages**. Make it a PWA so it's installable and works offline.

> Trade-off: a pure web app can't see *which other app* you're using, so
> category time becomes manual rather than automatic.

### 3. Hybrid: local agent + hosted dashboard
Keep a tiny desktop/CLI agent that does the OS-level tracking locally, and have
it sync records to a hosted backend + web dashboard you can open anywhere.
- **Backend/DB options:** [Supabase](https://supabase.com),
  [Firebase](https://firebase.google.com), [Neon](https://neon.tech), or
  [PlanetScale](https://planetscale.com) (all have free tiers).
- **Dashboard hosting:** Vercel / Netlify / Cloudflare Pages.
- This gives you "access it online" while preserving automatic tracking — at
  the cost of your data leaving the device (so add auth + encryption).

### 4. Cloud sync only
Keep the desktop app as the tracker, but back up/sync the exported JSON to cloud
storage (e.g. an S3/R2 bucket, or a Supabase table) so you can view/restore it
from other machines.

**Summary:** if you want zero servers and full automatic tracking → **option 1**.
If "online" means *open it in a browser from anywhere* → **option 2** (manual
tracking) or **option 3** (hybrid, keeps automatic tracking but needs a backend).
Tell me which direction you prefer and I can scaffold it.
