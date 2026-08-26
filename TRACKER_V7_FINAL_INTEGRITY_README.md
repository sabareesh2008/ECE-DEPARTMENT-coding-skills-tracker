# CodeMetrix Tracker V7 — Final Integrity Fix

## Bugs fixed

### 1. Individual dashboard Last 14 Days always showed 0
`script.js` never assigned `profile14Days`.
Fixed.

### 2. Total = 152 / 7 Days = 152 type corruption
Historical rows are now trusted only when:
- register number matches
- LeetCode username matches
- Status is Success
- cumulative total is valid
- E/M/H matches total when available
- historical total is not greater than current total
- cumulative history does not decrease

Leading zero bootstrap rows are ignored once the account has a later positive
cumulative total. This prevents a bad first `0` fetch from becoming a fake
`152 - 0 = 152` rolling count.

### 3. Username-change contamination
Old history for a previous LeetCode username cannot be used for a new username.

### 4. Full-feed cross-check
If LeetCode's accepted feed is proven complete for a window, a historical
NEW-problem count cannot be larger than the distinct accepted problems visible
in that complete feed. A conflicting historical baseline is rejected.

### 5. Hard mathematical invariants
Before a successful student row is published:

Today <= 7 Days <= 14 Days <= 30 Days <= Total Solved

and:

Easy + Medium + Hard = Total Solved

Impossible rows are rejected instead of being written to LiveData/History.

### 6. Missing data
When a rolling window has no trustworthy history and no complete accepted feed,
the internal source is `INSUFFICIENT_HISTORY`.
The leaderboard/student dashboard displays `N/A`, not a fake zero.

### 7. Daily Activity
Keep using `repair_daily_activity.py` from V6 once. The graph displays only
rows marked Exact=true, so multi-day gaps are not assigned to one fake day.

## Test command

python validate_tracker_integrity.py

It must finish with:

ALL TRACKER INTEGRITY CHECKS PASSED
