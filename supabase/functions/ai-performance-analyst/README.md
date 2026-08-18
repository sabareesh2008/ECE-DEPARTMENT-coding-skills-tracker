# AI Performance Analyst Edge Function

Admin-only AI analytics over Supabase performance data.

Required Edge Function secrets:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (recommended: a model available to your OpenAI project; default in source is `gpt-5.6`)

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.

Deploy:

```powershell
npx supabase functions deploy ai-performance-analyst
```

Then set secrets:

```powershell
npx supabase secrets set OPENAI_API_KEY=YOUR_KEY
npx supabase secrets set OPENAI_MODEL=gpt-5.6
```

The function validates the user's Supabase Auth JWT and requires `public.user_roles.role = 'admin'`.
