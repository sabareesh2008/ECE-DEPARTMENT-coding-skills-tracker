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

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const githubOwner = Deno.env.get("GITHUB_OWNER");
    const githubRepo = Deno.env.get("GITHUB_REPO");

    if (!githubToken || !githubOwner || !githubRepo) {
      return new Response(
        JSON.stringify({
          error: "GitHub secrets are missing",
          hasToken: !!githubToken,
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

    const workflow =
      Deno.env.get("GITHUB_WORKFLOW_FILE") ||
      "update-leetcode.yml";

    const ref =
      Deno.env.get("GITHUB_REF") ||
      "main";

    const githubUrl =
      `https://api.github.com/repos/${githubOwner}/${githubRepo}` +
      `/actions/workflows/${workflow}/dispatches`;

    console.log("Dispatching:", githubUrl);
    console.log("Ref:", ref);

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

    console.log(
      "GitHub status:",
      response.status
    );

    console.log(
      "GitHub response:",
      responseText
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "GitHub workflow dispatch failed",
          status: response.status,
          response: responseText,
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "LeetCode tracker started successfully",
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