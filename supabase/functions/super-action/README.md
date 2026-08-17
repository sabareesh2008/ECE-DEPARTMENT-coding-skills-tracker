# `super-action` Edge Function

Used by the Admin **Sync Now** button to trigger the GitHub Actions LeetCode tracker.

Set these Supabase Edge Function secrets:

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WORKFLOW_FILE=update-leetcode.yml`
- `GITHUB_REF=main`

The function validates the caller's Supabase Auth JWT and requires
`public.user_roles.role = 'admin'` before dispatching the workflow.
