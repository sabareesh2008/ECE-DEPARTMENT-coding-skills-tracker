Campus360 auto-fetch update

The student dashboard now attempts to find the exact entered registration number in both Supabase projects configured in config.js. It first calls campus360_lookup_student(registration number), then tries the legacy public.students table for matching register_number. It requests only that single row, not the entire student table.

The current roster RPC returns registration number, full name, section and LeetCode username. If the legacy students table is readable, it can also return department, academic_year and GitHub username. Private email/phone and private campus360_student_profiles are not exposed in prototype mode; secure authentication is required to fetch them. The page does not update database records while in prototype mode.

If the page says no matching record, confirm which configured Supabase project has the roster and that the CAMPUS360_SIGNUP_SETUP.sql lookup function or public.students table has been installed there. Do not make the whole student profile table public just to make prototype lookup work.
