# Campus360 × CodeMetrix — Master Product Requirements

## 1. Portals and authorization
- **Student:** one individual account, only their own profile, personal to-dos, assigned work, submissions, results and achievements. Official roster identity fields are read-only.
- **Faculty:** individually authenticated account with admin-assigned department and section scope. Faculty can see/manage only assigned sections, not other sections or institution-wide admin controls.
- **Admin:** authorized college-level account that manages roster, academic structure, roles, cross-section publishing, audit events and overall reports.
- Do not use a shared faculty password or let users choose their own role during sign-up. Assign roles and section scopes through a trusted admin workflow. Enforce permissions in Supabase RLS/Edge Functions, not just by hiding buttons.

## 2. Student registration
1. Student opens Student portal → Sign in → “Don’t have an account? Sign up”.
2. Student enters registration number. The system looks up the preloaded roster.
3. Show roster-controlled name, department, section, year, LeetCode username and GitHub username where those values exist. Keep them read-only.
4. Student supplies phone, personal email, college email, optional profile photo, unique username, password and confirmation.
5. Check username availability; show a password-strength meter and password-match feedback. Validate the college email against an approved roster email or invitation where available.
6. Create a Supabase Auth account, create the student role/profile through a database trigger, and ask the student to confirm their email if confirmation is enabled. Return to sign-in after successful submission.
7. Sign-in accepts email, username or registration number plus password. Username/reg-number resolution must be server-side, must not disclose email addresses, and should use rate limiting and generic authentication errors.

**Roster data limitation:** the current `students.csv` provides registration number, name, LeetCode username and section only. Department can be inferred from the section prefix. Year and GitHub username cannot be fetched until the roster is expanded. Never invent missing values.

## 3. Student dashboard
- Overview: identity card, profile photo, section/year, tasks due, tests upcoming, completion percentage and coding progress.
- Official profile fields are read-only; editable fields are phone, personal email, verified external profile links, photo and selected preferences. College email changes require verification.
- Task checklist: assigned tasks, due dates, status, proof upload, resubmission/correction status and submission receipt.
- Exams and technical tests: available, in progress, submitted, results released and attempt history.
- Personal to-do list: add, edit, complete, archive; this is private to the student unless explicitly shared.
- Achievements/certifications: title, issuer, date, credential URL and optional proof.
- Badges: awarded for clearly defined events (streaks, task completion, verified certificates); badge rules must be transparent and not reward fake activity.
- CodeMetrix: GitHub/LeetCode sync state, last updated time, daily/date-range activity, solved-problem trends, coding streak and leaderboard position.

## 4. Faculty dashboard
- Login uses an individual faculty account; the admin assigns department and permitted sections. Avoid a shared “general password”.
- Home metrics: total active students in assigned sections, task assigned/submitted/pending counts, test/exam completion, students with personal to-do lists, and completion trends. Faculty can view student to-do entries only where college policy explicitly permits; personal to-dos should default to private.
- Publish section-specific or multiple-section tasks, exams and technical tests with title, instructions, publish time, due date, maximum marks, allowed attempts, attachment links and proof requirements.
- Review proofs, mark accepted/rejected/needs correction, leave feedback and retain a timestamped history.
- Export CSV/XLSX/PDF for GitHub activity, LeetCode solving history, daily/date-range activity, tasks, tests, results and submitted proofs. Export must obey the same section access restrictions.
- Pending list: names + registration numbers for students who have not submitted/completed an item; filters by section, date, item and status.

## 5. Admin dashboard
- Add/edit/deactivate roster records; bulk CSV import with duplicate validation and preview before committing. Deleting should normally be soft-deactivation to preserve audit history.
- Assign roles and faculty section scopes. Keep a protected break-glass admin process and audit every privilege change.
- College-wide and department/section analytics, tracker health, task/exam/test completion, missing submissions and coding progress.
- Publish to one section, multiple sections, department or all students.
- Manage academic year, semester, department, section, due-date calendar, notification templates and retention rules.

## 6. Reminder / WhatsApp workflow shared by faculty and admin
1. Select scope (one section, selected sections, department or whole college) and a task/exam/test.
2. Query the actual submission/completion records and generate a pending list.
3. Preview a WhatsApp-ready message containing item name, due date, only the relevant section/scope, pending student names and registration numbers, and a respectful call to action.
4. Buttons: **Copy reminder message**, **Copy pending names/registration numbers**, and optionally **Open WhatsApp** with a prefilled message. The user reviews and manually sends it. Browser clipboard access requires a click.
5. Log when the reminder was generated and by whom; do not expose other sections in a section-specific reminder. Avoid posting sensitive marks or private data to a group chat.

Automatic WhatsApp delivery requires an approved WhatsApp Business API/provider and college consent. A copy/paste helper alone does not send messages.

## 7. Suggested additions
- Calendar with due-date reminders and a student “what should I do next?” queue.
- Proof version history and late-submission flags.
- Data export audit log and downloadable report manifest.
- Accessibility/mobile-first design and Tamil/English interface option.
- Backup/restore, data-retention policy, account recovery, email verification and rate limiting.
- Tracker freshness/failed sync alerts so stale GitHub/LeetCode data is not misrepresented as current.
- A demo mode with fake records for judging, clearly separated from live college data.

## 8. Integration status
The current package preserves existing CodeMetrix modules and adds the registration form, roster lookup, username check, password-strength UI, photo storage setup and identifier-login Edge Function source. The existing faculty/admin/student dashboard pages still link to legacy CodeMetrix modules; the full unified data workflows listed above require mapping to the actual existing task, assessment, proof, GitHub and LeetCode schemas and testing the RLS policies in a staging Supabase project. Do not assume this document means every workflow is already live.
