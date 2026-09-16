# CodeMetrix LeetCode Extension Backend Setup

## 1. Supabase
Run `ADD_LEETCODE_SUBMISSIONS.sql` in Supabase SQL Editor.

## 2. Render
The existing `code-runner` service now exposes:

`POST /api/leetcode/submission`

It uses the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` Render environment variables. No service-role key is placed in the extension.

## 3. Extension
Use the updated `CodeMetrix-LeetCode-Extension-v0.2` folder. Set the API URL to:

`https://ece-department-coding-skills-tracker.onrender.com`

The API verifies that the register number and LeetCode username match the `students` table before storing the submitted code.

## 4. Test
1. Deploy the updated Render service.
2. Reload the unpacked extension from `chrome://extensions`.
3. Open the extension and enter register number + LeetCode username.
4. Enter the Render URL above and save.
5. Log into LeetCode normally.
6. Open a problem and submit.
7. Check Supabase -> Table Editor -> `leetcode_submissions`.

The extension does not ask for or transmit a LeetCode password or session cookie.
