# CodeMetrix Exact Tracker V2

## Exact calculation used

Today:
current total solved - yesterday's final total solved

Last 7 Days:
current total solved - total solved at the end of the date 7 days ago

Last 14 Days:
current total solved - total solved at the end of the date 14 days ago

Last 30 Days:
current total solved - total solved at the end of the date 30 days ago

All calendar boundaries use Asia/Kolkata.

## Removed bug

The old tracker used LeetCode recent accepted submissions for 7/14/30.
That public list can be incomplete for active users, causing values such as
20 / 20 / 20.

V2 NEVER uses that feed for 7/14/30.

## Console coverage

Example:
coverage=T:OK 7:OK 14:NA 30:NA

OK   = exact boundary snapshot exists.
NA   = CodeMetrix did not store that historical boundary.
BOOT = Today is using the recent-feed bootstrap because yesterday is absent.

V2 uses 0 for an unavailable historical window rather than inventing a number.

## Important historical limitation

No program can reconstruct an exact arbitrary user's old 7/14/30-day unique
solved history from LeetCode's public recent-submission feed once those
accepted submissions have fallen outside the public recent list.

So:
- existing trustworthy boundary snapshots are used immediately;
- new snapshots are correct in IST;
- after 7 / 14 / 30 days of continuous tracking, those windows are fully
  trustworthy for every student.

Do not delete History.csv or student_performance_history.
