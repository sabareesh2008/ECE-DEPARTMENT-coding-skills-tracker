# CodeMetrix LeetCode Extension Setup

## Architecture

GitHub Pages hosts the CodeMetrix website. It is static, so it does not receive submission code directly.
The extension talks to a Supabase Edge Function instead:

LeetCode -> Chrome Extension -> Supabase Edge Function -> `leetcode_submissions`

## 1. Run SQL

Run `ADD_LEETCODE_EXTENSION.sql` in Supabase SQL Editor.

For the first test student:

```sql
select s.register_number, s.student_name, s.leetcode_username, t.extension_token
from public.students s
join public.student_extension_tokens t using (register_number)
where s.register_number = '922525106255';
```

Copy the returned `extension_token`.

## 2. Deploy the Edge Function

From the project root, after linking the Supabase project:

```powershell
supabase functions deploy leetcode-submission --no-verify-jwt
```

If the CLI asks for login/linking, use your Supabase account/project as normal.

The function URL is:

`https://bmbdkmtplemvlglqbgee.supabase.co/functions/v1/leetcode-submission`

The Edge Function needs the standard Supabase secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides to deployed functions. Do not put the service-role key in GitHub Pages or the extension.

## 3. Load the extension

Chrome -> `chrome://extensions` -> Developer mode -> Load unpacked -> select `CodeMetrix-LeetCode-Extension`.

## 4. Configure the extension

- Register Number: `922525106255`
- LeetCode Username: `Rithik2008`
- Extension Pairing Token: the value returned by the SQL query above
- Supabase Project URL is already filled in

## 5. Test

Open a LeetCode problem while logged in as that student. Submit normally. After LeetCode shows the submission result, wait a few seconds.

Then check:

```sql
select id, register_number, leetcode_username, submission_id,
       problem_title, language, status, submitted_at
from public.leetcode_submissions
where register_number = '922525106255'
order by submitted_at desc
limit 10;
```

To inspect the stored source code:

```sql
select problem_title, language, status, source_code
from public.leetcode_submissions
where register_number = '922525106255'
order by submitted_at desc
limit 1;
```
