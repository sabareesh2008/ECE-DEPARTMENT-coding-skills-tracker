# Fix "Failed to fetch" and enable the individual student dashboard

## Why username / registration-number login failed
The existing login page calls this Supabase Edge Function for usernames and registration numbers:
`/functions/v1/campus360-login-identifier`
If the function is not deployed to the exact project in `config.js`, the browser reports `Failed to fetch`. Email/password login goes directly through Supabase Auth and does not call this function.

## 1. Check the project
Open `config.js`. The function must be deployed to the project identified by `APP_CONFIG.SUPABASE_URL` (currently the CodeMetrix tracker project). Do not deploy it to the other `PORTAL_SUPABASE_URL` by mistake.

## 2. Deploy the included Edge Function
From the extracted project root (the folder containing `supabase/`), install/login to Supabase CLI if needed, then run:

```bash
supabase login
supabase link --project-ref bmbdkmtplemvlglqbgee
supabase functions deploy campus360-login-identifier
```

If your `SUPABASE_URL` points to a different project, use that project's actual ref instead of `bmbdkmtplemvlglqbgee`.

Set the Edge Function secrets on that same project. The service-role key must be a secret in Supabase, never in `config.js`:

```bash
supabase secrets set SUPABASE_URL=https://bmbdkmtplemvlglqbgee.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Use the actual project keys from Supabase Dashboard → Project Settings → API. Do not paste service-role keys into chat, source files, or browser code.

## 3. Apply dashboard SQL
Back up the database first. In the Supabase SQL Editor for the same project, run `CAMPUS360_LOGIN_DASHBOARD_FIX.sql`.
This adds own-profile read/update RPCs and a personal to-do table protected by row-level security. It does not grant a student access to other students' profiles or overwrite the master roster.

## 4. Deploy the files
Replace these files in your existing website folder with the versions in this ZIP:
- `portal-auth.js`
- `student-dashboard.html`
- `student-dashboard.js`
- `CAMPUS360_LOGIN_DASHBOARD_FIX.sql`

Keep `config.js` in the same directory. Clear browser cache or use Ctrl+F5 after deployment.

## 5. Test
1. Try signing in with the college email and password first.
2. After confirming email if required, test username and registration number. If it still fails, open Supabase Dashboard → Edge Functions → `campus360-login-identifier` → Logs.
3. The student dashboard should display the signed-in student's own profile and private personal to-do list.

## Important
The login Edge Function looks up `college_email` and `username` from `campus360_student_profiles`. The registration trigger must have successfully populated `college_email`, `username`, and `reg_no` for the new user. If email login works but username/registration login says invalid credentials, verify those profile fields and the role row.
