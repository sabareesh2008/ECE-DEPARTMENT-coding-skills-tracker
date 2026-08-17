# ECE LeetCode Platform — Full Featured Final Build

This ZIP is prepared from the supplied existing project and includes all features
discussed up to the current build.

## Included features

### LeetCode leaderboard
- ECE A–F + Overall
- Register-number ordered student table
- Correct table/header alignment
- Today / 7 Days / 30 Days / Total / Easy / Medium / Hard
- Status for invalid usernames
- Top Performance / Section Championship
- Student progress profile
- Faculty Analytics
- CSV / Excel / PDF dashboard export
- GitHub Actions LeetCode tracker

### Daily Challenge
- Admin posts daily LeetCode challenge
- Automatic tracker completion detection
- Total completed
- Current / longest streak
- Section mini statistics
- Student profile challenge data
- Faculty challenge analytics

### Daily Coding Test
- Admin test manager
- Create/delete/publish/close test
- Add/delete questions
- Add/delete public and hidden test cases
- Automatic question numbering
- Any register number stored in `students` can enter
- Java 21 Docker compiler
- Compiler/runtime/TLE output
- Sample tests
- Trusted server-side hidden judging
- Timer + auto submit
- Copy / paste / cut / right-click blocking
- Tab/fullscreen violation logging
- ONE attempt per student per test
- `End Test` with TWO confirmations
- Final screen shows only:
  - ALL TEST CASES PASSED
  - NOT ALL TEST CASES PASSED
- Automatic return to leaderboard
- Coding-test statistics in section cards
- Coding-test statistics in student profiles
- Coding-test analytics in Faculty Analytics

### Automated Email Reports
Daily and weekly reports include:
- Styled HTML email
- Excel `.xlsx` attachment
- PDF `.pdf` attachment
- LeetCode performance
- Daily Challenge statistics
- Coding Test statistics
- Top / bottom performers
- Section analytics
- Multiple recipient emails
- Automatic recipient batching

### Deployment
- GitHub Actions tracker
- GitHub Actions daily report
- GitHub Actions weekly report
- Docker Java runner
- Render blueprint
- Supabase Edge Function source for Admin Sync Now

---

# A. BRAND-NEW SUPABASE PROJECT

For a fresh Supabase project, do **NOT** run the older SQL files one-by-one.

Run only:

`SUPABASE_FRESH_SETUP.sql`

This prevents the old function/table ordering conflicts.

Then:

1. Supabase Authentication → Users → create your admin email/password.
2. Open `CREATE_ADMIN_ROLE.sql`.
3. Replace `YOUR_ADMIN_EMAIL@example.com`.
4. Run it in SQL Editor.

Import your student records into `public.students`.

Required columns:
- `register_number`
- `student_name`
- `leetcode_username`
- `section`

---

# B. FRONTEND CONFIG

Edit `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_...",
  CODE_RUNNER_URL: "http://localhost:8080"
};
```

Never put a secret/service-role key in `config.js`.

---

# C. LOCAL JAVA RUNNER

Copy:

`.env.runner.example`

to:

`.env.runner`

Fill:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`

Start Docker Desktop.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-runner.ps1
```

Open:

`http://localhost:8080/health`

Expected:

```json
{
  "ok": true,
  "jdk": "21",
  "hidden_judge_ready": true
}
```

---

# D. LOCAL WEBSITE

Use VS Code Live Server.

Open:
`http://127.0.0.1:5500/index.html`

Do not use `file:///`.

Test:
1. ECE A–F / Overall
2. Student profile
3. Daily Challenge
4. Faculty Analytics
5. Admin CRUD
6. Coding Test
7. One-attempt rule
8. End Test confirmations
9. Hidden judging
10. Coding analytics refresh

---

# E. EMAIL REPORTS — LOCAL

Install dependencies:

```powershell
python -m pip install -r requirements.txt
```

Set the required environment variables in PowerShell:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `REPORT_FROM_EMAIL`
- `REPORT_TO_EMAILS`

Preview daily:

```powershell
python report_generator.py --mode daily --dry-run
```

Send daily:

```powershell
python report_generator.py --mode daily
```

Preview weekly:

```powershell
python report_generator.py --mode weekly --dry-run
```

Send weekly:

```powershell
python report_generator.py --mode weekly
```

Each real email contains:
- HTML body
- Excel attachment
- PDF attachment

---

# F. NEW GITHUB REPOSITORY

This ZIP intentionally contains **no old `.git` folder**.

From the project root:

```powershell
git init
git add .
git status
git commit -m "Initial commit - full ECE LeetCode platform"
git branch -M main
git remote add origin YOUR_NEW_REPOSITORY_URL
git push -u origin main
```

Before `git commit`, make sure `.env.runner` is NOT staged.

After the repository is connected, later updates can be pushed with:

```powershell
powershell -ExecutionPolicy Bypass -File .\push-live.ps1
```

---

# G. GITHUB ACTIONS SECRETS

Repository → Settings → Secrets and variables → Actions.

Add:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `REPORT_FROM_EMAIL`
- `REPORT_TO_EMAILS`

The repository contains:
- `.github/workflows/update-leetcode.yml`
- `.github/workflows/daily-report.yml`
- `.github/workflows/weekly-report.yml`

Manually run each workflow once before relying on schedules.

---

# H. ADMIN SYNC NOW EDGE FUNCTION

Source:
`supabase/functions/super-action/index.ts`

Deploy it to the SAME Supabase project.

Set Edge Function secrets:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WORKFLOW_FILE=update-leetcode.yml`
- `GITHUB_REF=main`

The function requires a valid logged-in admin account.

---

# I. GITHUB PAGES

After the local system and GitHub Actions work:

Repository → Settings → Pages → Deploy from branch → `main` → `/root`.

The frontend can be published with GitHub Pages.

---

# J. LIVE JAVA COMPILER

Deploy `code-runner/` as a Docker web service.

A `render.yaml` is included.

Server environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`

After deployment, open:

`https://YOUR_RUNNER_DOMAIN/health`

Then change:

```js
CODE_RUNNER_URL: "http://localhost:8080"
```

to the live HTTPS runner URL and push again.

---

# SECURITY

Never commit:
- Supabase secret/service-role key
- Resend API key
- GitHub PAT/token
- `.env.runner`

If a secret is ever visible in a screenshot/chat/repository, rotate it before production.
