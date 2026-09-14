# CodeMetrix Student Profile Request Workflow

This update adds a public student profile-request flow without giving students write access to the main `students` table.

## What it does

- Adds **Request Profile** to the top-right of the public home page.
- Students submit register number, name, year, department, section, LeetCode username/link and GitHub username/link.
- LeetCode and GitHub are verified before the request can be submitted.
- Invalid / missing profiles are rejected before a request is stored.
- Requests are stored in `profile_requests`.
- Public search shows **Profile Active**, **Request Pending**, **Request Rejected**, or **Profile Not Found**.
- Admins get **Profile Requests**.
- **Bulk Add / Update All** adds new students and updates existing students matched by register number.
- Existing tracker/history metrics are not replaced; only student identity/profile fields are updated.

## One-time Supabase setup

1. Open Supabase SQL Editor.
2. Run `PROFILE_REQUESTS_SETUP.sql`.
3. Deploy the new Edge Function `supabase/functions/profile-request/index.ts`.
4. Because this function intentionally supports public validation/status/request submission, deploy it with JWT verification disabled. The included `supabase/config.toml` contains:

```toml
[functions.profile-request]
verify_jwt = false
```

5. Keep `SUPABASE_SERVICE_ROLE_KEY` only in Supabase Edge Function secrets. Never put it in `config.js`.

## Existing students

Bulk processing matches by `register_number`.

- Register number exists → update the student's profile/academic identity fields.
- Register number does not exist → insert a new student.
- A duplicate LeetCode/GitHub username belonging to another register number is reported as a failed request rather than overwriting that other student.
