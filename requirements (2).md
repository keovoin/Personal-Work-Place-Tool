# Requirements Document

## Introduction

The Hybrid Productivity Dashboard is a privacy-focused desktop application that combines automatic time tracking, manual task logging, and periodic energy/focus check-ins into a single tool. The application runs as a system tray app that monitors the active window to capture how time is spent, lets users record completed tasks, prompts for energy check-ins three times per day, and produces a daily summary and weekly review report with AI-generated insights. All data remains on the user's device, and core tracking and reporting functions operate without an internet connection.

The product goal is to give users a complete picture of their work with minimal friction (mostly automatic capture), surface actionable insights rather than raw data, and keep the user in full control of their own data. The architecture is intended to start simple and allow features to be added incrementally.

## Glossary

- **System**: The Hybrid Productivity Dashboard desktop application as a whole.
- **Tray_App**: The system tray component that runs in the background and provides access to application controls.
- **Time_Tracker**: The component that detects and records the currently active application window and its focus duration.
- **Activity_Record**: A stored entry capturing an active window's application name, window title, start time, and duration.
- **Categorizer**: The component that assigns each Activity_Record to a category (Work, Break, or Distraction).
- **Category**: A classification label for an Activity_Record, one of: Work, Break, Distraction, or Uncategorized.
- **Task_Logger**: The component that records manually entered completed tasks.
- **Task_Entry**: A user-created record describing a completed task, including a description and a timestamp.
- **Check_In_Scheduler**: The component that prompts the user for energy and focus check-ins at scheduled times.
- **Check_In_Entry**: A stored record containing an energy rating, a focus rating, and a timestamp.
- **Daily_Summary**: A generated report covering one calendar day of recorded activity, tasks, and check-ins.
- **Weekly_Report**: A generated report covering a seven-day period, including AI insights.
- **Insight_Engine**: The component that analyzes recorded data and generates textual insights for the Weekly_Report.
- **Dashboard_View**: The visual interface that displays summaries, reports, and charts to the user.
- **Local_Store**: The on-device storage where all application data is persisted.
- **User**: The person operating the application on their own device.

## Requirements

### Requirement 1: Automatic Time Tracking

**User Story:** As a knowledge worker, I want the application to automatically record which application I am actively using, so that I can see how my time is spent without manual logging.

#### Acceptance Criteria

1. WHILE the Time_Tracker is enabled, THE Time_Tracker SHALL detect the currently active window application name and window title at intervals no longer than 5 seconds.
2. WHEN the active window changes to a different application or window title, THE Time_Tracker SHALL create an Activity_Record containing the application name, window title, start time, and duration of the previous active window.
3. WHEN the active window remains unchanged across a detection interval, THE Time_Tracker SHALL accumulate the elapsed time into the current Activity_Record.
4. IF the Time_Tracker confirms an absence of both user input and active window changes for 5 minutes, THEN THE Time_Tracker SHALL mark the current Activity_Record as idle and stop accumulating active time until the next active window change or user input.
5. WHEN an Activity_Record is created, THE Time_Tracker SHALL persist the Activity_Record to the Local_Store.

### Requirement 2: Activity Categorization

**User Story:** As a user reviewing my time, I want each tracked activity to be labeled as work, break, or distraction, so that I can understand the nature of how I spend time.

#### Acceptance Criteria

1. WHEN an Activity_Record is created, THE Categorizer SHALL assign the Activity_Record a Category of Work, Break, Distraction, or Uncategorized based on user-defined rules that map application names to categories.
2. IF no user-defined rule matches an Activity_Record, THEN THE Categorizer SHALL assign the Category Uncategorized to the Activity_Record.
3. WHEN the User assigns a Category to an application name, THE Categorizer SHALL store the mapping in the Local_Store and apply the mapping to both existing Activity_Records and subsequent Activity_Records for that application name.
4. WHEN the User changes the Category of an existing Activity_Record, THE System SHALL update the stored Activity_Record with the new Category.

### Requirement 3: Manual Task Logging

**User Story:** As a user, I want to log tasks I have completed, so that I have a record of my accomplishments alongside my tracked time.

#### Acceptance Criteria

1. WHEN the User submits a Task_Entry with a non-empty description, THE Task_Logger SHALL persist the Task_Entry to the Local_Store with the description and the current timestamp.
2. IF the User submits a Task_Entry with an empty description, THEN THE Task_Logger SHALL reject the Task_Entry, prevent its persistence to the Local_Store, and display a validation message.
3. WHEN the User requests deletion of a Task_Entry, THE Task_Logger SHALL remove the Task_Entry from the Local_Store.
4. WHEN the User edits the description of an existing Task_Entry, THE Task_Logger SHALL update the stored Task_Entry with the revised description.

### Requirement 4: Energy and Focus Check-Ins

**User Story:** As a user, I want to be prompted to rate my energy and focus a few times a day, so that I can correlate my well-being with my productivity.

#### Acceptance Criteria

1. THE Check_In_Scheduler SHALL prompt the User for a Check_In_Entry three times per day at user-configurable times.
2. WHEN the User submits a Check_In_Entry, THE System SHALL persist the energy rating, focus rating, and current timestamp to the Local_Store.
3. WHERE the User has configured custom check-in times, THE Check_In_Scheduler SHALL issue prompts at the configured times.
4. IF the User dismisses a check-in prompt without submitting a Check_In_Entry, THEN THE Check_In_Scheduler SHALL record the prompt as skipped and SHALL reissue the prompt once after 30 minutes.
5. WHEN the User submits a Check_In_Entry with an energy or focus rating outside the range of 1 to 5 inclusive, THE System SHALL clamp each out-of-range rating to the nearest valid value (a rating below 1 becomes 1, a rating above 5 becomes 5) before persisting the Check_In_Entry.

### Requirement 5: Daily Summary Notification

**User Story:** As a user, I want an end-of-day summary, so that I can reflect on my day without opening the full dashboard.

#### Acceptance Criteria

1. WHEN the configured end-of-day time is reached, THE System SHALL generate a Daily_Summary covering the current calendar day.
2. THE Daily_Summary SHALL include total tracked time per Category, the count of completed Task_Entry records, and the average energy and focus ratings from the day's Check_In_Entry records.
3. WHEN a Daily_Summary is generated, THE System SHALL display a notification containing the Daily_Summary.
4. WHERE no Activity_Record, Task_Entry, or Check_In_Entry exists for the current calendar day, THE System SHALL display a Daily_Summary notification indicating that no activity was recorded.

### Requirement 6: Weekly Review Report with AI Insights

**User Story:** As a user, I want a weekly report with insights, so that I receive actionable guidance rather than raw data.

#### Acceptance Criteria

1. WHEN the User requests a Weekly_Report, THE System SHALL generate a Weekly_Report covering the preceding seven-day period.
2. THE Weekly_Report SHALL include total tracked time per Category, completed Task_Entry counts, and energy and focus trends across the seven-day period.
3. WHEN a Weekly_Report is generated, THE Insight_Engine SHALL produce at least one textual insight derived from the recorded Activity_Record, Task_Entry, and Check_In_Entry data of the period, including when zero days of data are recorded.
4. IF fewer than two days of recorded data exist in the seven-day period, THEN THE Insight_Engine SHALL include a statement in the Weekly_Report that insufficient data is available for reliable insights.
5. THE Insight_Engine SHALL generate insights using only data stored in the Local_Store.

### Requirement 7: Dashboard Visualization

**User Story:** As a user, I want a visual dashboard, so that I can explore my time, tasks, and well-being data interactively.

#### Acceptance Criteria

1. WHEN the User opens the Dashboard_View, THE Dashboard_View SHALL display tracked time grouped by Category for a user-selected date range.
2. WHEN the User opens the Dashboard_View, THE Dashboard_View SHALL display the list of Task_Entry records for the selected date range.
3. WHEN the User opens the Dashboard_View, THE Dashboard_View SHALL display energy and focus ratings over the selected date range.
4. WHEN the User changes the selected date range, THE Dashboard_View SHALL update the displayed data to reflect the new date range.

### Requirement 8: System Tray Operation

**User Story:** As a user, I want the application to run from the system tray, so that it stays out of my way while running in the background.

#### Acceptance Criteria

1. WHILE the System is running, THE Tray_App SHALL display an icon in the operating system tray.
2. WHEN the User activates the Tray_App icon, THE Tray_App SHALL present controls to open the Dashboard_View, log a Task_Entry, and enable or disable the Time_Tracker.
3. WHEN the User selects the disable Time_Tracker control, THE Time_Tracker SHALL stop creating Activity_Records until tracking is re-enabled.
4. WHEN the User selects the enable Time_Tracker control, THE Time_Tracker SHALL resume creating Activity_Records.
5. WHEN the System shuts down, THE Time_Tracker SHALL be disabled and SHALL remain disabled until the User manually re-enables tracking.

### Requirement 9: Local-Only Data Storage and Privacy

**User Story:** As a privacy-conscious user, I want all my data to stay on my device, so that I retain full control over my personal information.

#### Acceptance Criteria

1. THE System SHALL persist all Activity_Record, Task_Entry, and Check_In_Entry data exclusively in the Local_Store on the User's device.
2. WHEN the User requests export of stored data, THE System SHALL write the data to a user-selected file location on the User's device.
3. WHEN the User requests deletion of all stored data, THE System SHALL remove all Activity_Record, Task_Entry, and Check_In_Entry data from the Local_Store.
4. WHERE an Insight_Engine feature requires processing data, THE Insight_Engine SHALL process the data on the User's device.

### Requirement 10: Offline Operation

**User Story:** As a user, I want the application to work without internet, so that I can rely on it anywhere.

#### Acceptance Criteria

1. WHILE no network connection is available, THE Time_Tracker SHALL continue to create and persist Activity_Records.
2. WHILE no network connection is available, THE Task_Logger SHALL continue to persist Task_Entry records.
3. WHILE no network connection is available, THE Check_In_Scheduler SHALL continue to prompt for and persist Check_In_Entry records.
4. WHILE no network connection is available, THE System SHALL continue to generate Daily_Summary and Weekly_Report outputs.

### Requirement 11: Data Persistence Across Restarts

**User Story:** As a user, I want my recorded data to survive application restarts, so that I never lose my history.

#### Acceptance Criteria

1. WHEN the System starts, THE System SHALL load previously persisted Activity_Record, Task_Entry, and Check_In_Entry data from the Local_Store.
2. IF the Local_Store data file is missing at startup, THEN THE System SHALL create a new empty Local_Store and continue operation.
3. IF the Local_Store data file is corrupted at startup, THEN THE System SHALL preserve the corrupted file under a backup name and create a new empty Local_Store.
4. IF creation of a new Local_Store fails due to insufficient disk space or insufficient permissions, THEN THE System SHALL continue operating without persistence capabilities and SHALL notify the User that data will not be saved.
