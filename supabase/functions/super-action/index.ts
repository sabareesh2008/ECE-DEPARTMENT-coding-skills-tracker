import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const jwt = authHeader.replace("Bearer ", "").trim();

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || roleRow?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Administrator access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let requestBody: Record<string, unknown> = {};

    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }

    const tracker =
      requestBody?.tracker === "github"
        ? "github"
        : "leetcode";

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const githubOwner = Deno.env.get("GITHUB_OWNER");
    const githubRepo = Deno.env.get("GITHUB_REPO");

    const workflowFile =
      tracker === "github"
        ? (
            Deno.env.get("GITHUB_WORKFLOW_FILE_GITHUB")
            ?? "github-tracker.yml"
          )
        : (
            Deno.env.get("GITHUB_WORKFLOW_FILE")
            ?? "update-leetcode.yml"
          );

    const githubRef = Deno.env.get("GITHUB_REF") ?? "main";

    if (!githubToken || !githubOwner || !githubRepo) {
      throw new Error(
        "Missing GITHUB_TOKEN, GITHUB_OWNER or GITHUB_REPO Edge Function secret.",
      );
    }

    const endpoint =
      `https://api.github.com/repos/${githubOwner}/${githubRepo}` +
      `/actions/workflows/${workflowFile}/dispatches`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: githubRef,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitHub workflow dispatch failed (${response.status}): ${body}`,
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tracker,
        message:
          tracker === "github"
            ? "GitHub tracker workflow started."
            : "LeetCode tracker workflow started.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
