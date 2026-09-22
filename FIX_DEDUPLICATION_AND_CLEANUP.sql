-- =====================================================================
-- CODEMETRIX: PERMANENT DEDUPLICATION & AUTO-CLEANUP SCRIPT
-- Run this in Supabase SQL Editor to remove existing duplicates and
-- guarantee that NEVER will any duplicate problem be stored or shown.
-- =====================================================================

BEGIN;

-- 1. DELETE ALL EXISTING DUPLICATE ROWS, KEEPING ONLY THE MOST RECENT SUBMISSION
DELETE FROM public.student_leetcode_submissions a
USING public.student_leetcode_submissions b
WHERE a.id < b.id
  AND lower(trim(a.register_number)) = lower(trim(b.register_number))
  AND lower(trim(a.problem_slug)) = lower(trim(b.problem_slug));

-- 2. DROP OLD CONSTRAINTS AND ADD STRICT UNIQUE CONSTRAINT
ALTER TABLE public.student_leetcode_submissions DROP CONSTRAINT IF EXISTS uq_student_problem;
ALTER TABLE public.student_leetcode_submissions DROP CONSTRAINT IF EXISTS uq_student_submission;
ALTER TABLE public.student_leetcode_submissions ADD CONSTRAINT uq_student_problem UNIQUE (register_number, problem_slug);

-- 3. BEFORE INSERT TRIGGER: AUTOMATICALLY DELETES ANY PREVIOUS RECORD FOR THE SAME PROBLEM
-- Even if an API or extension tries an INSERT without UPSERT, older versions are replaced instantly!
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_duplicate_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.student_leetcode_submissions
  WHERE lower(trim(register_number)) = lower(trim(NEW.register_number))
    AND lower(trim(problem_slug)) = lower(trim(NEW.problem_slug));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_submission ON public.student_leetcode_submissions;
CREATE TRIGGER trg_prevent_duplicate_submission
BEFORE INSERT ON public.student_leetcode_submissions
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_prevent_duplicate_submission();

-- 4. ROLLING 50 SUBMISSIONS PRUNE TRIGGER
CREATE OR REPLACE FUNCTION public.prune_student_excess_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.student_leetcode_submissions
  WHERE register_number = NEW.register_number;

  IF v_count > 50 THEN
    DELETE FROM public.student_leetcode_submissions
    WHERE id IN (
      SELECT id FROM public.student_leetcode_submissions
      WHERE register_number = NEW.register_number
      ORDER BY submitted_at ASC
      LIMIT (v_count - 50)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_submissions ON public.student_leetcode_submissions;
CREATE TRIGGER trg_prune_submissions
AFTER INSERT OR UPDATE ON public.student_leetcode_submissions
FOR EACH ROW EXECUTE FUNCTION public.prune_student_excess_submissions();

COMMIT;

-- VERIFICATION QUERY (Should return 0 rows):
SELECT register_number, problem_slug, count(*)
FROM public.student_leetcode_submissions
GROUP BY register_number, problem_slug
HAVING count(*) > 1;
