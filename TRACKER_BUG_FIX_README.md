# Immediate LeetCode rolling-window bug fix

## What was wrong

The previous tracker calculated Last 7 / 14 / 30 Days from
`recentAcSubmissionList`.

For active profiles this feed may expose only a small recent set, which can
cause values such as:

`20 / 20 / 20`

even when the student solved far more problems.

## New calculation

The tracker now uses the cumulative LeetCode `Problems Solved` total stored
in daily History.csv snapshots.

For each window:

`rolling solved = current cumulative total - historical cumulative total`

Old `Last 7 Days`, `Last 14 Days`, and `Last 30 Days` values in History.csv
are NOT trusted for calculation.

Same-day duplicate history rows are collapsed in the calculation.

## Important coverage rule

The tracker cannot reconstruct activity from dates before your first reliable
snapshot. Until enough history is collected, console output shows:

`history coverage 7d=partial 14d=partial 30d=partial`

After enough daily history exists, it becomes `full`.

This is intentional: partial real data is better than fabricated/capped 20s.

## Supabase

Run once:

`FIX_HISTORY_DUPLICATES_AND_TRACKER.sql`

This:
- makes a backup
- removes only same-student + same-date duplicates
- preserves different daily snapshots
- adds a unique index so duplicates cannot return

## Then

Push tracker.py and run:

GitHub -> Actions -> Update LeetCode Leaderboard -> Run workflow
