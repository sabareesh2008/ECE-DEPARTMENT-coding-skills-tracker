# Report V5 Preferred Format

Daily: Top 10, 0 Solved Today (only 0 solved AND 0 submissions), Today Submissions, 7/14/30, Total Solved. Lifetime Total Submissions removed.

Weekly: Top 10, 0 Solved This Week, Bottom 10, Weekly Submissions, 14/30, Total Solved. Completely inactive 0/0 students are excluded from Bottom 10 to avoid duplication.

Run REPORT_V5_SUBMISSION_SNAPSHOTS.sql once. Scheduled daily 07:00 reports save cumulative submission counters so future 07:00->07:00 submission counts are exact by subtraction. If the first boundary snapshot is missing, the public recent submission feed is used only when it fully covers the requested window; otherwise N/A/partial is shown and the student is not falsely added to the zero-solved list.
