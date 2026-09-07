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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service configuration is missing.");
    }

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
        JSON.stringify({
          error: "Invalid user session",
          details: userError?.message ?? "No user found",
        }),
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

    if (roleError) {
      throw new Error(`Role lookup failed: ${roleError.message}`);
    }

    if (roleRow?.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Administrator access required",
          role: roleRow?.role ?? null,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: Record<string, unknown> = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const tracker = body.tracker === "github" ? "github" : "leetcode";

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const githubOwner = Deno.env.get("GITHUB_OWNER");
    const githubRepo = Deno.env.get("GITHUB_REPO");

    const workflowFile =
      tracker === "github"
        ? Deno.env.get("GITHUB_WORKFLOW_FILE_GITHUB") ??
          "github-tracker.yml"
        : Deno.env.get("GITHUB_WORKFLOW_FILE") ??
          "update-leetcode.yml";

    const githubRef = Deno.env.get("GITHUB_REF") ?? "main";

    if (!githubToken) {
      throw new Error("GITHUB_TOKEN secret is missing.");
    }

    if (!githubOwner) {
      throw new Error("GITHUB_OWNER secret is missing.");
    }

    if (!githubRepo) {
      throw new Error("GITHUB_REPO secret is missing.");
    }

    const endpoint =
      `https://api.github.com/repos/${githubOwner}/${githubRepo}` +
      `/actions/workflows/${workflowFile}/dispatches`;

    console.log("Dispatching GitHub workflow:", {
      owner: githubOwner,
      repo: githubRepo,
      workflow: workflowFile,
      ref: githubRef,
      tracker,
      tokenPresent: true,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: githubRef,
      }),
    });

    const responseBody = await response.text();

    console.log("GitHub response:", {
      status: response.status,
      body: responseBody,
    });

    if (!response.ok) {
      throw new Error(
        `GitHub dispatch failed. HTTP ${response.status}: ${responseBody}`,
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tracker,
        workflow: workflowFile,
        message:
          tracker === "github"
            ? "GitHub tracker workflow started."
            : "LeetCode tracker workflow started.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("SUPER-ACTION ERROR:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error
          ? error.message
          : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});git add .
git commit -m "sync now bug fix"
git pull --rebase origin main
git push origin main