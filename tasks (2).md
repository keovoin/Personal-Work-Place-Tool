# Implementation Plan: Hybrid Productivity Dashboard

## Overview

This plan converts the approved design into a sequence of incremental coding steps for an Electron + TypeScript application. The strategy is to build the deterministic domain core first (pure functions: serializer, categorizer, time-tracker step logic, task validation, rating clamp, aggregator, insight engine), validate each piece with property-based tests using `fast-check`, then layer the persistence (SQLite Repository) and the platform shell (tray, schedulers, notifications, renderer UI) on top, finishing by wiring everything together.

Each task builds on the previous ones. Property tests target the 21 correctness properties from the design and are placed immediately after the code they validate so errors surface early. Property test sub-tasks are tagged with their property number and the requirement clause they check. Test sub-tasks are marked optional with `*`.

## Tasks

- [x] 1. Set up project structure, tooling, and core types
  - [x] 1.1 Initialize the Electron + TypeScript project and test tooling
    - Create the directory layout (`src/main`, `src/core`, `src/data`, `src/renderer`, `test`)
    - Configure TypeScript, the Electron build entry points, the unit test runner (Vitest/Jest), and add `fast-check` as a dev dependency
    - Add `active-win`, `better-sqlite3` as dependencies and wire npm scripts for build/test
    - _Requirements: 8.1, 10.1_

  - [x] 1.2 Define core domain types and interfaces
    - Create TypeScript definitions for `Category`, `ActivityRecord`, `CategoryRule`, `TaskEntry`, `CheckInEntry`, `Settings`, `DailySummary`, `WeeklyReport`, `DateRange`, `TimeOfDay`, `ActiveWindow`, `TrackerState`, `Result`, and `ValidationError`
    - Declare the component interfaces (`TimeTracker`, `Categorizer`, `TaskLogger`, `CheckInScheduler`, `Aggregator`, `InsightEngine`, `Repository`, `TrayController`)
    - _Requirements: 1.2, 2.1, 3.1, 4.2, 5.2, 6.2, 9.1, 11.1_

- [x] 2. Implement serialization and the persistence layer
  - [x] 2.1 Implement the pure serializer/deserializer
    - Write `serialize`/`deserialize` functions that convert the full dataset (activities, tasks, check-ins, rules, settings) to and from a stable on-disk/export representation
    - _Requirements: 9.2, 11.1_

  - [x]* 2.2 Write property test for export round-trip
    - **Property 19: Export round-trip** — serialize then deserialize yields a dataset deeply equal to the original
    - **Validates: Requirements 9.2**

  - [x] 2.3 Implement the SQLite Repository
    - Create the SQLite schema (`activities`, `tasks`, `check_ins`, `category_rules`, `settings`) with indexes on time columns
    - Implement `init()` (created/loaded/recovered/no-persistence), `saveActivity`, `saveTask`, `saveCheckIn`, `queryActivities`, `queryTasks`, `queryCheckIns`, `exportAll`, `deleteAll` against an injectable file/in-memory backend
    - Implement startup recovery: missing-file creation, corrupted-file backup + recreate, and memory-only fallback on creation failure
    - _Requirements: 9.1, 9.2, 9.3, 11.1, 11.2, 11.3, 11.4_

  - [x]* 2.4 Write property test for persistence round-trip across restart
    - **Property 21: Persistence round-trip across restart** — persisting records and reloading the store returns data equal to what was persisted
    - **Validates: Requirements 11.1, 1.5, 4.2, 3.4**

  - [x]* 2.5 Write property test for delete-all
    - **Property 20: Delete-all clears the store** — after `deleteAll`, every query returns an empty result
    - **Validates: Requirements 9.3**

  - [x]* 2.6 Write unit tests for Repository startup branches
    - Cover missing-file creation (`created`), corrupted-file backup + recreate (`recovered`), and creation-failure memory-only mode (`no-persistence`)
    - _Requirements: 11.2, 11.3, 11.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the Categorizer
  - [x] 4.1 Implement category rule resolution and bulk application
    - Write `categorize(appName, rules)` with case-insensitive matching and `Uncategorized` fallback
    - Write `applyRulesToRecords(records, rules)` to re-derive categories for existing records
    - _Requirements: 2.1, 2.2, 2.3_

  - [x]* 4.2 Write property test for categorization by rule with fallback
    - **Property 3: Categorization by rule with fallback** — returns the matching rule's category or `Uncategorized` when none matches
    - **Validates: Requirements 2.1, 2.2**

  - [x]* 4.3 Write property test for rule application to records
    - **Property 4: Rule application to records** — every matching record carries the rule's category; non-matching records carry `Uncategorized`
    - **Validates: Requirements 2.3**

  - [x]* 4.4 Write unit test for changing a single record's category
    - Verify updating one Activity_Record's category persists the new value
    - _Requirements: 2.4_

- [x] 5. Implement the TimeTracker step logic
  - [x] 5.1 Implement the pure poll/accumulate/split/idle function
    - Implement `poll(previousState, now, active, systemIdleSeconds, idleThreshold)` returning accumulation, window-change splits (emitting completed records), and idle marking
    - Apply the tracking-enabled gate so no records are produced while disabled
    - _Requirements: 1.2, 1.3, 1.4, 8.3, 8.4_

  - [x]* 5.2 Write property test for time accumulation and window split
    - **Property 1: Time accumulation and window split** — unchanged windows accumulate summed elapsed intervals; window changes emit a completed record with the previous window's fields
    - **Validates: Requirements 1.2, 1.3**

  - [x]* 5.3 Write property test for idle threshold detection
    - **Property 2: Idle threshold detection** — idle time >= threshold marks `isIdle` and halts accumulation; below threshold does not
    - **Validates: Requirements 1.4**

  - [x]* 5.4 Write property test for the tracking gate
    - **Property 18: Tracking gate** — completed Activity_Records are produced if and only if tracking is enabled
    - **Validates: Requirements 8.3, 8.4**

- [x] 6. Implement the TaskLogger
  - [x] 6.1 Implement task add/edit/delete with validation
    - Write `add`/`edit` rejecting empty or whitespace-only descriptions (returning `ValidationError`), persisting valid entries with the current timestamp; write `delete`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.2_

  - [x]* 6.2 Write property test for valid task persistence
    - **Property 5: Valid task is persisted with its description preserved** — any description with a non-whitespace character is stored with description equal to the input
    - **Validates: Requirements 3.1**

  - [x]* 6.3 Write property test for whitespace-only rejection
    - **Property 6: Whitespace-only tasks are rejected** — whitespace-only/empty input is rejected, nothing persisted, task set unchanged
    - **Validates: Requirements 3.2**

  - [x]* 6.4 Write property test for task deletion invariant
    - **Property 7: Task deletion invariant** — after deleting a subset, the store contains exactly the unselected tasks
    - **Validates: Requirements 3.3**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the CheckInScheduler and rating clamping
  - [x] 8.1 Implement scheduling, dismissal reissue, and clamping
    - Write `scheduledPrompts(times)` (exactly three prompts at configured times), `onDismiss` (mark skipped + single +30min reissue), and `onSubmit` (clamp energy/focus to 1–5 before producing the entry)
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 10.3_

  - [x]* 8.2 Write property test for check-in scheduling
    - **Property 8: Check-in scheduling** — three configured times produce exactly three prompts at those times
    - **Validates: Requirements 4.1, 4.3**

  - [x]* 8.3 Write property test for dismissed-and-reissued check-in
    - **Property 9: Dismissed check-in is skipped and reissued once** — a dismissed prompt is marked skipped with exactly one reissue at `t + 30 minutes`
    - **Validates: Requirements 4.4**

  - [x]* 8.4 Write property test for rating clamping
    - **Property 10: Rating clamping** — persisted ratings lie in `[1,5]`, in-range values unchanged, below 1 → 1, above 5 → 5, and clamping is idempotent
    - **Validates: Requirements 4.5**

- [x] 9. Implement the Aggregator
  - [x] 9.1 Implement daily summary aggregation
    - Write `dailySummary(date, data)` computing per-category time sums, completed task count, average energy/focus (null when none), and `empty` flag
    - _Requirements: 5.2, 5.4_

  - [x]* 9.2 Write property test for daily summary aggregation
    - **Property 11: Daily summary aggregation** — per-category time, task count, averages (or null), and `empty` match the day's records
    - **Validates: Requirements 5.2, 5.4**

  - [x] 9.3 Implement weekly figures and range-based grouping
    - Write `weeklyFigures(range, data)` (per-category totals, task count, per-day energy/focus trends) and `timeByCategory(records, range)` with inclusive range filtering
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3, 7.4_

  - [x]* 9.4 Write property test for weekly aggregation and trends
    - **Property 12: Weekly aggregation and trends** — per-category time/task count equal period totals; trend arrays have one per-day average entry
    - **Validates: Requirements 6.2**

  - [x]* 9.5 Write property test for weekly report range filtering
    - **Property 13: Weekly report range filtering** — only records within the inclusive seven-day period contribute
    - **Validates: Requirements 6.1**

  - [x]* 9.6 Write property test for dashboard category grouping over a range
    - **Property 16: Dashboard category grouping over a range** — per-category grouping equals summed in-range durations and excludes out-of-range records
    - **Validates: Requirements 7.1**

  - [x]* 9.7 Write property test for date-range filtering determinism
    - **Property 17: Date-range filtering is a deterministic function of the range** — querying tasks/check-ins returns exactly the in-range records for each requested range
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 10. Implement the InsightEngine
  - [x] 10.1 Implement local insight generation
    - Write `generate(period)` that always returns at least one insight from local data only and adds an insufficient-data statement when fewer than two distinct data-days exist
    - _Requirements: 6.3, 6.4, 6.5, 9.4_

  - [x]* 10.2 Write property test for at-least-one-insight
    - **Property 14: At least one insight always produced** — even an empty period yields >= 1 insight
    - **Validates: Requirements 6.3**

  - [x]* 10.3 Write property test for insufficient-data statement
    - **Property 15: Insufficient-data statement** — periods with fewer than two data-days include the insufficient-data statement
    - **Validates: Requirements 6.4**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement the platform shell (Main process)
  - [x] 12.1 Implement the TrayController
    - Create the tray icon and menu (open dashboard, log task, enable/disable tracking); hold the tracking-enabled flag defaulting to disabled on startup
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x]* 12.2 Write unit tests for tray menu and startup default
    - Verify menu contents and that tracking defaults to disabled on every startup
    - _Requirements: 8.2, 8.5_

  - [x] 12.3 Wire the TimeTracker to active-window polling and idle detection
    - Drive the pure poll step from `active-win` and Electron `powerMonitor.getSystemIdleTime()` at an interval `<= 5s`, persisting completed records via the Repository, gated by the tracking flag
    - _Requirements: 1.1, 1.5, 8.3, 8.4, 10.1_

  - [x] 12.4 Wire the CheckInScheduler and SummaryScheduler
    - Schedule the three daily check-in prompts and the end-of-day summary; on end-of-day, build the Daily_Summary via the Aggregator and dispatch a notification (including the "no activity recorded" case)
    - _Requirements: 4.1, 5.1, 5.3, 5.4, 10.3, 10.4_

  - [x]* 12.5 Write integration tests for OS-coupled triggers
    - Cover poll cadence (1.1), end-of-day trigger (5.1), and notification dispatch (5.3) with representative examples
    - _Requirements: 1.1, 5.1, 5.3_

- [x] 13. Implement the renderer UI
  - [x] 13.1 Implement task entry and check-in prompt UI
    - Build the task entry form (showing the validation message on rejection) and the check-in prompt capturing energy/focus, communicating with the Main process via IPC
    - _Requirements: 3.1, 3.2, 4.2_

  - [x] 13.2 Implement the DashboardView
    - Render time-by-category, the task list, and energy/focus ratings for a user-selected date range, re-requesting aggregated data when the range changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 13.3 Implement export and delete-all data controls
    - Add UI controls that invoke `Repository.exportAll` (to a user-selected file) and `Repository.deleteAll`
    - _Requirements: 9.2, 9.3_

- [x] 14. Integration and wiring
  - [x] 14.1 Wire all components together at application startup
    - On launch, call `Repository.init()`, load persisted data (Requirement 11.1), construct the domain core with injected Repository, start the tray, and connect renderer IPC handlers
    - _Requirements: 8.1, 9.1, 11.1, 11.2, 11.3, 11.4_

  - [x]* 14.2 Write smoke tests for offline/local-only guarantees
    - Assert no network client is wired into components and that core flows (track, log, check-in, daily summary, weekly report) succeed with networking disabled
    - _Requirements: 6.5, 9.1, 9.4, 10.1, 10.2, 10.3, 10.4_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Each task references specific requirement clauses for traceability.
- Checkpoints ensure incremental validation as the system grows.
- The 21 property-based tests validate the universal correctness properties from the design; unit, integration, and smoke tests cover edge branches, OS-coupled triggers, and architectural offline/local-only guarantees.
- Property-based tests use `fast-check` with a minimum of 100 iterations each and are tagged with `// Feature: productivity-dashboard, Property {number}: {property_text}`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "4.1", "5.1", "6.1", "8.1", "9.1", "9.3", "10.1"] },
    { "id": 3, "tasks": ["2.3", "2.2", "4.2", "4.3", "4.4", "5.2", "5.3", "5.4", "6.2", "6.3", "6.4", "8.2", "8.3", "8.4", "9.2", "9.4", "9.5", "9.6", "9.7", "10.2", "10.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "12.1", "12.3", "12.4"] },
    { "id": 5, "tasks": ["12.2", "12.5", "13.1", "13.2", "13.3"] },
    { "id": 6, "tasks": ["14.1"] },
    { "id": 7, "tasks": ["14.2"] }
  ]
}
```
