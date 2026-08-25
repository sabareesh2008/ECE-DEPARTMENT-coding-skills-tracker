# CodeMetrix Tracker V3 Final Fix

## Why V2 showed 30 Days = 0

V2 required an exact snapshot from 30 days ago.
If CodeMetrix had only a few days of stored history, V2 deliberately returned 0.

That was mathematically strict, but bad for the live dashboard because older
non-zero information was already available.

## V3 source priority

For Today:
1. EXACT cumulative-total delta from yesterday.
2. RECENT accepted submissions from today.

For 7 / 14 / 30 Days:
1. EXACT cumulative-total boundary, when CodeMetrix has that historical date.
2. RECENT high-limit accepted-submission count.
3. CACHED last non-zero historical rolling value.
4. ZERO only when no usable source exists at all.

Console shows the source for every metric:
`source=T:EXACT 7:EXACT 14:RECENT 30:CACHED`

## Important truth about "exact"

For an arbitrary public LeetCode profile, LeetCode does not expose a guaranteed
complete first-solve history with timestamps. Therefore a 30-day value from
before CodeMetrix started storing daily cumulative snapshots cannot always be
proven exact retroactively.

From the point daily cumulative snapshots exist, CodeMetrix can calculate
Today / 7 / 14 / 30 exactly from its own history.
