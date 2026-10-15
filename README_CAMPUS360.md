# Campus360 + CodeMetrix — Integrated Project Package

## What is included

This package is built on top of the supplied CodeMetrix ZIP. The existing CodeMetrix files are retained, including its Supabase configuration, assessment/task modules, coding analytics, Python trackers, GitHub Actions, reports and code-runner folder. New Campus360 files add a landing page with three role entry points, a Supabase Auth login gate, and student/faculty/admin workspace hubs.

### New entry files
- `index.html` — Campus360 landing page with Student, Faculty and Admin portals.
- `login.html` / `portal-auth.js` — Supabase email/password login and role verification.
- `signup.html` / `signup.js` — student sign-up: enter registration number, fetch preloaded roster details, verify, then create an email/password account.
- `CAMPUS360_SIGNUP_SETUP.sql` — additive roster, student profile/role tables, roster seed from `students.csv`, and the signup trigger.
- `student-dashboard.html` — student hub linking to existing academic and CodeMetrix features.
- `faculty-dashboard.html` — faculty hub for tasks, assessments and analytics.
- `admin-dashboard.html` — admin hub for existing management and reporting modules.
- `codemetrix-dashboard.html` — copy of the original CodeMetrix `index.html` so the original dashboard remains directly available.
- `CAMPUS360_ADDITIVE_SETUP.sql` — optional namespaced schema for future Campus360 records; no existing tables are dropped or altered.

## Supabase values are retained

`config.js` was copied unchanged from the supplied CodeMetrix project. It contains two existing Supabase project URLs and publishable/browser keys; both were retained as provided. Do not replace them unless you deliberately migrate the existing project. Publishable keys are intended for browser use only when RLS/grants are correctly configured. Never add a Supabase service-role/secret key to frontend files.

## Important role setup

The login page signs in with Supabase Auth and then reads `public.user_roles` using `user_id = auth.users.id`. It expects the `role` value to be exactly `student`, `faculty`, or `admin`. Portal selection does not grant access. If your current `user_roles` table only contains admin entries, add student/faculty entries through a trusted administrator process after verifying your existing schema and policies. The current admin workflows may use the CodeMetrix tracking Supabase project; do not assume the separate task/assessment project has the same users or tables.

If the `user_roles` table does not permit the signed-in user to read their own role, login will stop with a clear error. Configure a narrowly scoped SELECT policy for the current user's role rather than making the table public. Existing schema details are not overwritten by the new SQL.

## How to run locally on Windows

1. Extract this ZIP into a folder.
2. Open PowerShell in that folder.
3. Start a local static server:
   ```powershell
   py -m http.server 8000
   ```
4. Open `http://localhost:8000`.
5. Test each portal using an account that already exists in Supabase Auth and has a matching `user_roles` row.
6. Existing CodeMetrix pages can also be opened directly: `codemetrix-dashboard.html`, `admin.html`, `tasks.html`, `tasks-admin.html`, `assessment.html`, `github.html`, and `leetcode.html`.

Do not test by double-clicking the HTML file (`file://`); use the local web server so browser modules and Supabase requests behave consistently.

## Database extension (optional)

`CAMPUS360_ADDITIVE_SETUP.sql` creates only `campus360_*` tables and enables RLS with no permissive policies. It is deliberately fail-closed. Run it only in the intended existing portal Supabase project's SQL Editor after reviewing it. The new tables will not be usable from the browser until grants and policies are deliberately designed, added, and tested for your roster/role schema. This protects student records and evidence from accidental public exposure.

The supplied CodeMetrix has existing tables/policies for tasks and assessments. Continue using those where they already support the workflow; do not run duplicate setup scripts blindly. Do not run `SUPABASE_FRESH_SETUP.sql` or other destructive/replacement scripts against a live project without first reviewing their effects and taking a backup.

## Features linked from dashboards

The workspace hubs link to the supplied CodeMetrix pages and reports. These links preserve existing modules rather than rewriting them. Some existing modules use their own legacy faculty/admin gating, task storage, or different Supabase project. A unified UI entry point does not automatically merge their databases or grant cross-project access.

## Before production

- Test student, faculty and admin accounts separately.
- Confirm `user_roles` RLS policies and all exposed table grants.
- Review legacy `tasks` policies and proof storage permissions. Supabase recommends RLS and least-privilege grants on exposed tables; service-role keys must remain server-side.
- Remove/rotate any shared passwords or credentials that were previously hard-coded in client-side code.
- Verify code runner sandboxing and limits before accepting untrusted code.
- Review public report artifacts before hosting them on a public static site.
- Verify each GitHub Action and external API integration in your own repository.
- Run the project's tests and manually verify the full workflow against your actual Supabase schema.

## Honest status

This is a generated integration package, not a live deployment. No changes were made to your Supabase projects by generating this ZIP. I cannot certify zero errors or production readiness without running against your live database, storage policies, GitHub secrets, hosting configuration and real test accounts. Existing CodeMetrix files are preserved; the new landing/login/workspace files are additive.


## Student sign-up and automatic roster fill

1. Back up the intended Supabase project and review `CAMPUS360_SIGNUP_SETUP.sql`. Run it in the same Supabase project configured by `SUPABASE_URL` in `config.js` (the login page uses that project). It seeds the `campus360_student_roster` table from the included `students.csv`.
2. For stronger identity verification, populate `approved_email` for each roster row with the student's official college email before opening self-sign-up. The SQL trigger enforces that email whenever it is populated. Do not treat registration-number-only lookup as production-grade identity proof.
3. Open `signup.html` through the local web server. Enter a registration number and click **Fetch details**; the matching name, section and listed LeetCode username are shown automatically. Then enter the email and password and create the account. If Supabase email confirmation is enabled, the student must confirm the email before signing in.
4. Successful student signup is linked to the roster by a database trigger and receives the `student` role. Sign in at `login.html?role=student`; the portal routes to the individual student dashboard.
5. Faculty/admin self-registration is deliberately disabled. A trusted administrator must create/verify the staff Auth account and add its UUID to `campus360_user_roles` with `faculty` or `admin`. Do not let users choose their own privileged role. Existing legacy `user_roles` accounts remain supported by the login fallback.

**Important:** the signup SQL is additive but does create a trigger on `auth.users`; review it before running. No live database was changed by generating this package. The roster lookup returns only the record matching the entered registration number, but for production you should add approved email/invitation-code verification and rate limiting.


## Expanded student registration and identifier sign-in (new)

The updated `signup.html` collects mobile number, personal email, college email, optional profile photo, unique username, password and confirmation. Registration-number lookup fills the roster fields that are actually available: name, section, LeetCode username and department inferred from section. Year and GitHub username remain “not available” unless the roster is enriched; they are never fabricated. Password strength is a client-side guidance indicator, while Supabase Auth remains responsible for password storage.

Run `CAMPUS360_PROFILE_AND_AUTH_SETUP.sql` after reviewing and backing up the target database. This migration adds profile columns, a boolean username-availability RPC, profile-photo storage policies and updates the signup trigger. Deploy `supabase/functions/campus360-login-identifier/index.ts` as the `campus360-login-identifier` Edge Function and configure server-side secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` using Supabase's secrets manager. The service-role key must never be placed in `config.js` or browser code. Email sign-in works directly; username/registration-number sign-in uses this function so the browser does not receive an email-lookup endpoint. Staff should use their registered email unless staff username aliases are configured separately.

## Requested operational workflow / implementation scope

- Students: private individual profile, task checklist, personal to-do list, achievement/certification records and earned badges; students may update only allowed profile fields. Official name, registration number, department, section and year remain roster-controlled.
- Faculty: section-scoped access; task/exam/test publishing; submission and completion counts; coding activity and proof exports; lists of students still pending.
- Admin: roster import/add/remove, approved roles, all-section publishing and institution-wide analytics.
- Reminders: generate a section-specific or college-wide WhatsApp-ready message listing only pending students; provide Copy message and Copy pending registration numbers. WhatsApp sending itself requires an approved WhatsApp Business integration; this build should not claim it sent messages automatically.

The dashboards in this package currently link to preserved CodeMetrix modules. Full unified faculty scoping, editable student profiles, personal to-do/badges, exports and WhatsApp message generation still require connecting each screen to the actual task/submission tables and enforcing authorization with Supabase RLS or server-side functions. Do not use client-side hiding as a security boundary. Before production, test against a staging Supabase project and replace the existing client-side shared advisor credential with server-side role authorization.


See `CAMPUS360_MASTER_REQUIREMENTS.md` for the full portal behavior, faculty/admin workflow, reminder workflow and recommended security additions.

## New profile/auth migration — run order

For the expanded registration form, run the existing `CAMPUS360_SIGNUP_SETUP.sql` first (if not already applied), then review and run `CAMPUS360_PROFILE_AND_AUTH_SETUP.sql`. Back up the database before applying migrations. The SQL is designed to be additive but must be tested in a staging project because it updates the Campus360 signup trigger and the lookup RPC return shape.

Deploy username/registration-number sign-in from the project root using the Supabase CLI:

```powershell
supabase functions deploy campus360-login-identifier
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_KEY
```

Configure `SUPABASE_ANON_KEY` as an Edge Function secret too if your Supabase project does not expose it automatically to the function runtime. Do not paste either key into browser code, commit them to Git, or share them in chat. Use the project URL that matches `APP_CONFIG.SUPABASE_URL` in `config.js`.

The new `campus360_roster_template.csv` shows the extra fields to populate if you want year, GitHub username and approved college email to be auto-filled/verified. Existing `students.csv` does not include those fields, so the current registration form shows them as unavailable until the roster is enriched.
