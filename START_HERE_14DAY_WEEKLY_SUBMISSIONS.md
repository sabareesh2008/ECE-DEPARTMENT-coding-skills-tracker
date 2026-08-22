# CodeMetrix metric upgrade

Added everywhere:
1. Last 14 Days — distinct accepted LeetCode problems.
2. Last 7 Days Submissions — ALL submission attempts, not solved count.
3. Existing Total Submissions remains lifetime submissions.

Existing Supabase project:
- Run `ADD_14DAY_WEEKLY_SUBMISSIONS.sql` once.
- Push the edited files.
- Manually run `Update LeetCode Leaderboard` once.

The new metrics flow through:
- tracker.py
- faculty_tracker.py
- LiveData.csv
- History.csv
- tracker-generated Students.xlsx
- main leaderboard
- Faculty leaderboard
- individual profile KPI cards
- CSV / Excel downloads
- daily and weekly report Excel/PDF/HTML data
- Smart Analyzer current/history data tables

Daily report remains section-wise and HOD Overall.
Daily workflow: 01:30 UTC = 07:00 AM IST.
Daily mode uses the previous calendar day.
