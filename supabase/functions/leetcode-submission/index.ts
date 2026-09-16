import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Supabase Edge Function secrets are not configured." }, 500);
  }

  try {
    const body = await req.json();
    const registerNumber = clean(body.register_number, 50);
    const leetcodeUsername = clean(body.leetcode_username, 100);
    const extensionToken = clean(body.extension_token, 200);
    const submissionId = clean(body.submission_id, 100);
    const sourceCode = String(body.source_code ?? "");
    const problemTitle = clean(body.problem_title, 300);
    const problemSlug = clean(body.problem_slug, 200);
    const language = clean(body.language, 100);
    const status = clean(body.status, 100);
    const submittedAt = body.submitted_at ? new Date(body.submitted_at) : new Date();

    if (!registerNumber || !leetcodeUsername || !extensionToken || !submissionId || !sourceCode) {
      return json({ error: "register_number, leetcode_username, extension_token, submission_id and source_code are required." }, 400);
    }

    if (sourceCode.length > 100_000) {
      return json({ error: "Source code is too large." }, 413);
    }

    if (Number.isNaN(submittedAt.getTime())) {
      return json({ error: "Invalid submitted_at value." }, 400);
    }

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("register_number, leetcode_username")
      .eq("register_number", registerNumber)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) return json({ error: "Student register number was not found." }, 404);

    if (String(student.leetcode_username ?? "").trim().toLowerCase() !== leetcodeUsername.toLowerCase()) {
      return json({ error: "Register number and LeetCode username do not match." }, 403);
    }

    const { data: tokenRow, error: tokenError } = await admin
      .from("student_extension_tokens")
      .select("extension_token")
      .eq("register_number", registerNumber)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow || tokenRow.extension_token !== extensionToken) {
      return json({ error: "Invalid CodeMetrix extension pairing token." }, 403);
    }

    const { data: existing, error: existingError } = await admin
      .from("leetcode_submissions")
      .select("id")
      .eq("register_number", registerNumber)
      .eq("submission_id", submissionId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return json({ ok: true, duplicate: true, id: existing.id });
    }

    const { data: inserted, error: insertError } = await admin
      .from("leetcode_submissions")
      .insert({
        register_number: registerNumber,
        leetcode_username: leetcodeUsername,
        submission_id: submissionId,
        problem_title: problemTitle,
        problem_slug: problemSlug,
        language,
        status,
        submitted_at: submittedAt.toISOString(),
        source_code: sourceCode,
        source: "codemetrix-extension",
      })
      .select("id, submission_id, problem_title, status, submitted_at")
      .single();

    if (insertError) throw insertError;

    return json({ ok: true, duplicate: false, submission: inserted });
  } catch (error) {
    console.error("LEETCODE SUBMISSION ERROR", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
