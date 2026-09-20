-- =====================================================================
-- CODEMETRIX LEETCODE SYNC - EXTENSION STATE & BYPASS DETECTION
-- Run once in Supabase SQL Editor.
-- =====================================================================

-- 1. Ensure columns exist on extension_installed_students
ALTER TABLE public.extension_installed_students 
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS extension_version TEXT DEFAULT '1.0.0';

-- 2. Indexes for fast heartbeat queries & status audits
CREATE INDEX IF NOT EXISTS idx_ext_inst_auto_sync ON public.extension_installed_students(auto_sync_enabled);
CREATE INDEX IF NOT EXISTS idx_ext_inst_last_active ON public.extension_installed_students(last_active_at DESC);

-- 3. Helpful Faculty View: extension_status_overview
-- Shows live extension health, last ping, and whether auto-sync is enabled
CREATE OR REPLACE VIEW public.extension_status_overview AS
SELECT 
  s.register_number,
  s.student_name,
  s.section,
  s.leetcode_username,
  e.student_email,
  e.extension_version,
  CASE 
    WHEN e.register_number IS NULL THEN 'NOT_INSTALLED'
    WHEN e.auto_sync_enabled = false THEN 'TURNED_OFF'
    WHEN e.last_active_at < (now() - interval '7 days') THEN 'INACTIVE_7D'
    ELSE 'ACTIVE'
  END AS extension_state,
  COALESCE(e.auto_sync_enabled, false) AS auto_sync_enabled,
  e.installed_at,
  e.last_active_at,
  COALESCE(sub_stats.total_synced_solutions, 0) AS total_synced_solutions,
  COALESCE(sub_stats.flagged_solutions, 0) AS flagged_solutions
FROM public.students s
LEFT JOIN public.extension_installed_students e 
  ON s.register_number = e.register_number
LEFT JOIN (
  SELECT 
    register_number,
    COUNT(*) AS total_synced_solutions,
    COUNT(*) FILTER (WHERE plagiarism_verdict IN ('FLAGGED', 'SUSPICIOUS')) AS flagged_solutions
  FROM public.student_leetcode_submissions
  GROUP BY register_number
) sub_stats 
  ON s.register_number = sub_stats.register_number
ORDER BY s.section, s.register_number;

-- 4. Grant permissions for view
GRANT SELECT ON public.extension_status_overview TO anon, authenticated;
