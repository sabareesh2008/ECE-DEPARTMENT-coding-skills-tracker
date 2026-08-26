# CodeMetrix Tracker V6 — Snapshot Truth

## Permanent fix

Public LeetCode recent accepted submissions are limited and cannot be used as
the authoritative source for high-activity 7 / 14 / 30 day counts.

V6 source order:

1. Cumulative `Problems Solved` history at the exact window boundary.
2. Fully-covered public recent accepted feed when history boundary is missing.
3. Safe cumulative-history lower bound.
4. Never fall back to a fake capped `20`.

## Example from the project history

If a profile had:

- 12 Aug total solved = 106
- current total solved = 203

then the cumulative increase is 97.

V6 will no longer display `20` merely because only 20 recent accepted
submissions were publicly returned.

## 30-day historical gaps

If CodeMetrix did not exist 30 days ago, the old exact value cannot be
reconstructed from LeetCode's public recent feed. V6 displays the strongest
provable lower bound and labels the internal source `LOWER_BOUND`.

After enough daily history is collected, it automatically becomes
`HISTORY_EXACT`.

## Daily Activity graph

The old tracker could put a multi-day increase on one fake day. Example:

12 Aug total 106
19 Aug total 203
gap increase 97

Old:
18 Aug = 97  (misleading)

V6:
The gap is NOT assigned to a single day.
Only consecutive, exact daily snapshots are shown in Daily Activity.

Run once:
`python repair_daily_activity.py`

## Calendar-private profiles

A hidden submission calendar no longer makes the whole profile fail.
Solved totals and rolling solved metrics still update.
Only the 7-day submission count is preserved from the previous good value.
