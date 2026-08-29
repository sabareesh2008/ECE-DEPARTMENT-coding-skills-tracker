# CodeMetrix AI Analytics — Free-Form Upgrade

This build keeps the existing AI Analytics UI unchanged, but upgrades the Supabase `ai-performance-analyst` Edge Function so normal free-form prompts are answered by Gemini using current LeetCode + GitHub + Daily Challenge + Coding Test data.

## One-time setup

1. Create a Gemini API key in Google AI Studio.
2. From this project folder, log in/link Supabase if needed.
3. Save the key as an Edge Function secret (do NOT place it in `config.js`):

```powershell
npx supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Optional model override:

```powershell
npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

4. Deploy the edited function:

```powershell
npx supabase functions deploy ai-performance-analyst --use-api
```

5. Push the edited website files to GitHub as usual.

## What changed
- Existing AI Analytics HTML/CSS layout: unchanged.
- Prompt box: accepts free-form questions instead of only predefined intents.
- AI context: current LeetCode + GitHub metrics, Daily Challenge, Coding Tests and section summaries.
- Existing XLSX/PDF/CSV deterministic report generation remains available.
- Back button: added to index, LeetCode and GitHub pages.
- Cross shortcuts: GitHub button on LeetCode page; LeetCode button on GitHub page.

## Security
Never place `GEMINI_API_KEY` in frontend JavaScript or GitHub source. Keep it only in Supabase Edge Function secrets.
