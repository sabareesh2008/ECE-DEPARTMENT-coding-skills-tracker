# CodeMetrix GitHub Tracker V1 — Start Here

## What this version changes

### Public entry page
`index.html` now has exactly two public choices:

- LeetCode Tracker → `leetcode.html`
- GitHub Tracker → `github.html`

### LeetCode
The existing LeetCode page, `script.js`, tracker and all LeetCode features are preserved.

### GitHub
`github.html` is cloned from the existing LeetCode UI and uses the same:

- hero/header
- section cards
- section leaderboard
- Overall leaderboard
- Champions
- search
- Actions popup
- CSV/PDF buttons
- Admin Login
- Add Profile
- Manage Students
- Sync Now
- Daily Challenge
- Daily Coding Test
- Student dashboard
- graphs/cards/modals/button styling

The only intentionally removed GitHub-page feature is **Faculty tracking / Faculty Analytics**.

## GitHub metrics tracked

### Contributions
- Today
- Last 7 days
- Last 14 days
- Last 30 days

### Commits
- Today
- Last 7 days
- Last 14 days
- Last 30 days

### Repositories
- Total public repositories
- Created today
- Created in last 7 days
- Created in last 14 days
- Created in last 30 days

### Deployment
- Detected deployed projects

A deployment is conservatively detected when:
- GitHub Pages is enabled, or
- the repository homepage points to a known deployment host such as
  Vercel, Netlify, Render, Firebase, Cloudflare Pages, Railway, Heroku,
  Azure Websites, Fly.io or Surge.

The UI says **Detected Deployments** because a public GitHub profile cannot
guarantee discovery of every private/custom deployment.

## One-time Supabase setup

Run:

`ADD_GITHUB_TRACKER.sql`

in Supabase SQL Editor.

## GitHub token

Recommended repository secret:

`GITHUB_TRACKER_TOKEN`

For only public profiles, the workflow can fall back to the automatic Actions
`github.token`, but a dedicated token is recommended for a larger student list.

Never put the token in `config.js`.

## Run locally

```powershell
cd C:\Sabareesh\ECE_LEETCODE_FULL_FEATURED_FINAL
pip install -r requirements.txt
python github_tracker.py
python -m http.server 8000
```

Open:

`http://localhost:8000`

The first page shows LeetCode and GitHub boxes.

## Add a student's GitHub username

GitHub page:

Admin Login → Actions → Add Profile

Enter the existing student's Register Number and GitHub username.

The student must already exist in the shared `students` table. This prevents
GitHub administration from accidentally creating a second student record.

On the GitHub page, Delete removes only the GitHub username. It never deletes
the student or LeetCode profile.

## Manual GitHub sync

GitHub page:

Admin Login → Sync Now

`super-action` now accepts `tracker: "github"` and dispatches
`.github/workflows/github-tracker.yml`.

Redeploy the updated `super-action` Edge Function after copying this project.

## Automatic schedule

GitHub tracker runs once every hour.

## Ranking

GitHub ranks use:

1. 30-day contributions
2. 30-day commits
3. total public repositories
4. detected deployments
5. register number

## Files

- `index.html` — public tracker selector
- `leetcode.html` — unchanged LeetCode UI
- `github.html` — GitHub clone of LeetCode UI
- `github-script.js` — GitHub page behavior
- `github_tracker.py` — GitHub data collector
- `ADD_GITHUB_TRACKER.sql` — Supabase migration
- `.github/workflows/github-tracker.yml` — hourly automation
- `GitHubLiveData.csv`
- `GitHubHistory.csv`
- `GitHubDailyActivity.csv`
- `github_students.csv`
