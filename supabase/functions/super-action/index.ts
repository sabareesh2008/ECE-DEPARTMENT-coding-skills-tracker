import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Invalid login session",
          details: userError?.message,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      return new Response(
        JSON.stringify({
          error: "Could not check admin role",
          details: roleError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (role?.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Admin access required",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const githubToken = (
      Deno.env.get("GITHUB_TOKEN") ||
      Deno.env.get("GUTHUB_TOKEN") ||
      Deno.env.get("GH_TOKEN") ||
      Deno.env.get("GITHUB_PAT") ||
      ""
    ).trim();
    const githubOwner = (
      Deno.env.get("GITHUB_OWNER") ||
      "sabareesh2008"
    ).trim();
    const githubRepo = (
      Deno.env.get("GITHUB_REPO") ||
      "ECE-DEPARTMENT-coding-skills-tracker"
    ).trim();

    if (!githubToken) {
      return new Response(
        JSON.stringify({
          error: "GitHub token is missing in Supabase Edge Function secrets. Please set GITHUB_TOKEN in Supabase Secrets.",
          hasToken: false,
          owner: githubOwner,
          repo: githubRepo,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let reqBody: Record<string, unknown> = {};
    try {
      reqBody = await req.json();
    } catch {
      reqBody = {};
    }

    const action = String(reqBody.action || reqBody.tracker || "").toLowerCase();
    console.log("Requested action:", action, "Body:", reqBody);

    const workflowsToDispatch: string[] = [];
    if (action === "trigger_github_sync" || action === "github") {
      workflowsToDispatch.push("github-tracker.yml");
    } else if (action === "trigger_leetcode_sync" || action === "leetcode") {
      workflowsToDispatch.push("update-leetcode.yml");
    } else if (action === "sync_all" || action === "all") {
      workflowsToDispatch.push("update-leetcode.yml");
      workflowsToDispatch.push("github-tracker.yml");
    } else {
      const defaultWorkflow = Deno.env.get("GITHUB_WORKFLOW_FILE") || "update-leetcode.yml";
      workflowsToDispatch.push(defaultWorkflow);
    }

    const ref = Deno.env.get("GITHUB_REF") || "main";
    const dispatchResults = [];
    let hasError = false;
    let lastErrorResponse = "";

    for (const workflow of workflowsToDispatch) {
      const githubUrl =
        `https://api.github.com/repos/${githubOwner}/${githubRepo}` +
        `/actions/workflows/${workflow}/dispatches`;

      console.log("Dispatching:", workflow, "to", githubUrl);

      const response = await fetch(githubUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "CodeMetrix",
        },
        body: JSON.stringify({
          ref: ref,
        }),
      });

      const responseText = await response.text();
      console.log(`GitHub response for ${workflow} (status ${response.status}):`, responseText);

      if (!response.ok) {
        hasError = true;
        lastErrorResponse = `Workflow ${workflow} failed: HTTP ${response.status} ${responseText}`;
      } else {
        dispatchResults.push(workflow);
      }
    }

    if (hasError && dispatchResults.length === 0) {
      return new Response(
        JSON.stringify({
          error: "GitHub workflow dispatch failed",
          details: lastErrorResponse,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const trackerNames = dispatchResults
      .map((w) => (w.includes("github") ? "GitHub Tracker" : "LeetCode Tracker"))
      .join(" & ");

    return new Response(
      JSON.stringify({
        success: true,
        message: `${trackerNames || "Tracker"} started successfully in GitHub Actions`,
        dispatched: dispatchResults,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("SUPER ACTION ERROR:", error);

    return new Response(
      JSON.stringify({
        error: "super-action failed",
        details: error instanceof Error
          ? error.message
          : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});