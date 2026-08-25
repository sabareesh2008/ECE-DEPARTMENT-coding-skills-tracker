# CodeMetrix Tracker V4 — Final Calculation Audit

## Metric definition

CodeMetrix now uses ONE definition everywhere:

**Solved Today / 7 / 14 / 30 Days**
= number of DISTINCT LeetCode problem titles with at least one ACCEPTED
submission inside that IST calendar-day window.

A repeated accepted submission to the same problem inside one window counts once.

## Fixed errors

1. Removed mixing of cumulative total-solved deltas with recent accepted activity.
   That mixing caused impossible rows such as 7 Days = 14 and 14 Days = 0.

2. Removed cached 7/14/30 historical rolling values from calculations.
   The existing History.csv contains older corrupted rolling fields, so V4 does
   not use them to calculate current windows.

3. All windows use Asia/Kolkata.

4. Window definitions are nested calendar windows:
   - Today: today 00:00 IST -> now
   - 7 Days: today + previous 6 dates
   - 14 Days: today + previous 13 dates
   - 30 Days: today + previous 29 dates

5. Added mandatory invariant:
   Today <= 7 Days <= 14 Days <= 30 Days

6. Total Submissions now uses totalSubmissionNum instead of accepted-submission
   totals.

7. 7D Submissions uses the submission calendar and the same 7 calendar dates.

8. API failures, 429s, timeouts and worker errors no longer overwrite good data
   with zeros.

9. Failed fetches do not create a new History.csv or Supabase history snapshot.

10. Duplicate register numbers are de-duplicated at runtime.

11. Reduced parallel workers to 8 and added transient retry handling.

12. Removed the shared calculate_completed_day_counts.last_coverage state from
    active tracking logic, eliminating a multi-thread race.

13. Accepted feed completeness is checked per window:
    - FULL means the returned accepted history is sufficient to cover the window.
    - PARTIAL means LeetCode did not return enough history to prove completeness.

## Important limitation

LeetCode does not provide an officially documented public endpoint that
guarantees a complete historical accepted-submission list for every arbitrary
public user.

V4 therefore detects partial coverage rather than silently claiming an
incomplete list is exact.

For normal student accounts where the returned feed covers the 30-day start,
Today/7/14/30 are all computed from the same complete accepted dataset.
