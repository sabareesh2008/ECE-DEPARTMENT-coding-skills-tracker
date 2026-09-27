# CodeMetrix — Unified Feature Organization

This version organizes the existing platform around one clear rule:

> One feature has one home.

## Main Hub

- Dashboard
- Available Exams
- LeetCode Tracker
- GitHub Tracker
- Task Submissions
- Leaderboard
- Student Directory
- Faculty & Admin
- Reports & Exports

## Available Exams

Only the student entry point is shown here:
- Start Test
- Exam guidelines

Test configuration, question management, publishing, results and consolidation are handled only inside the Faculty & Admin portal.

## LeetCode Tracker

The dedicated LeetCode workspace contains:
- Total student count
- Year menu
- Section-wise menu
- Overall view
- Detailed leaderboard
- LeetCode report center
- Top 50 Excel
- Current-view CSV/PDF
- Faculty analytics exports
- Date-range reports

Administrative controls are intentionally kept out of this page. Faculty/admin configuration is centralized in `admin.html`.

## GitHub Tracker

The dedicated GitHub workspace contains:
- Total student count
- Year menu
- Section-wise menu
- Overall view
- Detailed leaderboard
- GitHub report center
- Top 50 Excel
- Current-view CSV/PDF
- Faculty analytics exports
- Activity reporting

## Task Submissions

`tasks.html` is the student-facing task desk:
- Shows all published tasks
- Shows active/closed state
- Shows deadline
- Shows submission count
- Each active task has its own `Submit Task` action
- Clicking `Submit Task` opens the existing proof form
- Register number verification remains mandatory
- Screenshot proof upload and remarks remain unchanged

Task publishing, verification, pending lists, WhatsApp reminders and proof exports are handled only in `admin.html`.

## Leaderboard

The Hub leaderboard is intentionally lightweight:
- Top 5 LeetCode students
- Top 5 GitHub students

No downloadable formats are shown here. Detailed ranking/export functions remain in the respective tracker workspaces.

## Faculty & Admin

There is one visible administrative portal: `admin.html`.

It contains:
- Dashboard
- Coding monitoring
- Assessments
- Content / Question Bank
- Tasks
- Students & Faculty
- Reports
- System / integrations
- Manual MCQ/FIB question writer
- Question CSV/Excel import
- Test publishing
- Task publishing
- Task verification
- Student roster
- Faculty analytics
- Sync controls

`tasks-admin.html` is no longer exposed as a second admin portal in the UI.

## Reports & Exports

The Hub report page is reserved for cross-module/consolidated reports. Platform-specific LeetCode and GitHub reports live inside their own tracker pages to avoid duplication.
