# AI Performance Analyst — Setup

This build adds an **admin-only AI agent** to the ECE LeetCode platform.

## What it can do

- Best / top / bottom students by Today, 7 Days, 30 Days or Total
- Individual student strengths and weaknesses
- Student-vs-student comparisons
- ECE section comparisons
- Students needing attention
- Daily Challenge analysis
- Coding Test pass/fail/score analysis
- Faculty LeetCode ranking
- Personalized coding-question recommendations based on observed weaknesses
- Generate downloadable **Excel (.xlsx), PDF (.pdf), or CSV** reports from natural-language requests

Examples:

- `Who is the best student this week and why?`
- `What are the strengths and weaknesses of 922525106264?`
- `Compare ECE A and ECE E.`
- `Give me the top 50 students this week as Excel.`
- `Give students who failed the latest coding test as PDF.`
- `Export ECE C students needing attention as CSV.`

The AI does not calculate important metrics by guessing. It calls deterministic backend tools that query the current tracked data, then explains the result.

---

## 1. Replace/use this project version

The full ZIP already includes the frontend, tracker changes, SQL upgrade and Edge Function.

## 2. Run the AI SQL upgrade in Supabase

Supabase → SQL Editor → New query.

Run only:

`ADD_AI_PERFORMANCE_ANALYST.sql`

Expected final status:

`AI PERFORMANCE ANALYST DATABASE READY`

This creates:

- `student_performance_current`
- `student_performance_history`

## 3. Push the new code to GitHub

The important tracker change is in `tracker.py`. It now copies the deterministic LiveData metrics into the two Supabase analytics tables after every successful tracker run.

```powershell
git add .
git commit -m "Add AI Performance Analyst"
git push
```

## 4. Run the LeetCode tracker once

GitHub → Actions → Update LeetCode Leaderboard → Run workflow.

After it finishes, Supabase Table Editor should show rows in:

- `student_performance_current`
- `student_performance_history`

Do not continue until `student_performance_current` contains the students.

## 5. Create an OpenAI API key

Create an API key in your OpenAI API project. Do not place it in `config.js`, `script.js`, GitHub Pages, or the repository.

## 6. Link the Supabase CLI if needed

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

## 7. Set Edge Function secrets

```powershell
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
npx supabase secrets set OPENAI_MODEL=gpt-5.6
```

If `gpt-5.6` is not enabled for your OpenAI API project, set `OPENAI_MODEL` to a model available to that project.

## 8. Deploy the Edge Function

```powershell
npx supabase functions deploy ai-performance-analyst
```

The function is located at:

`supabase/functions/ai-performance-analyst/index.ts`

It verifies the caller's Supabase login and requires the `admin` role before reading class-wide analytics.

## 9. Test from the website

Log in as Admin.

You will see:

`🤖 AI Performance Analyst`

Try:

`Who is the best student this week and why?`

Then:

`Give me the top 50 students this week as Excel.`

The second request should show a **Download** card in the AI panel.

## 10. Supported downloadable formats

- `.xlsx` Excel
- `.pdf` PDF
- `.csv` CSV

Files are generated on the backend from the actual selected rows and returned to the admin browser. The OpenAI model does not fabricate the file rows.

## Security

Never commit or expose:

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- GitHub tokens
- `.env.runner`

The AI interface is admin-only in the frontend and the Edge Function independently checks the Supabase Auth user and `user_roles` table.
