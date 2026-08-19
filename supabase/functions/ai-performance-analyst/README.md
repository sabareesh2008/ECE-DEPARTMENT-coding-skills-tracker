# ECE Smart Performance Analyzer

This Supabase Edge Function is a built-in, deterministic analytics agent.

It does **not** use OpenAI, Gemini, Groq or any external LLM.

It reads the existing Supabase analytics data and supports natural-language patterns for:

- Top / bottom students by Today, 7 Days, 30 Days or Total
- Best student explanations
- Student strengths / weaknesses
- Student comparisons
- Section comparisons and rankings
- Students needing attention / inactive students
- Rule-based question recommendations
- Faculty LeetCode rankings
- Daily Challenge analysis
- Coding Test analysis
- Excel / PDF / CSV generation
- Follow-up requests such as `download that as Excel` using recent chat context

Required project environment variables are the standard Supabase Edge Function variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No `OPENAI_API_KEY` is required.
