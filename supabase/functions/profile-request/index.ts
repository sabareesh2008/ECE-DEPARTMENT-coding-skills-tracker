import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function cleanUsername(v: unknown) { return String(v ?? "").trim().replace(/\s+/g, ""); }
function validLink(link: unknown, host: string) {
  try { const u = new URL(String(link ?? "")); return u.protocol === "https:" && u.hostname.toLowerCase() === host; } catch { return false; }
}
function canonicalLink(platform: string, username: string) { return platform === "leetcode" ? `https://leetcode.com/u/${encodeURIComponent(username)}/` : `https://github.com/${encodeURIComponent(username)}`; }

async function validatePlatform(platform: string, username: string, profileLink: string) {
  const host = platform === "leetcode" ? "leetcode.com" : "github.com";
  if (!username || !validLink(profileLink, host)) throw new Error(`Invalid ${platform === "leetcode" ? "LeetCode" : "GitHub"} profile link.`);
  if (platform === "github") {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "ECE-CodeMetrix" } });
    if (!r.ok) throw new Error("GitHub profile was not found. Please check the username/link.");
    const data = await r.json();
    if (String(data.login || "").toLowerCase() !== username.toLowerCase()) throw new Error("GitHub username does not match the profile.");
    return { valid: true, canonical_link: canonicalLink(platform, data.login) };
  }
  const r = await fetch("https://leetcode.com/graphql", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "ECE-CodeMetrix" }, body: JSON.stringify({ query: `query($username:String!){ matchedUser(username:$username){ username } }`, variables: { username } }) });
  if (!r.ok) throw new Error("LeetCode verification service could not be reached. Please try again.");
  const data = await r.json();
  const matched = data?.data?.matchedUser;
  if (!matched?.username || String(matched.username).toLowerCase() !== username.toLowerCase()) throw new Error("LeetCode profile was not found. Please check the username/link.");
  return { valid: true, canonical_link: canonicalLink(platform, matched.username) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response("ok");
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  try {
    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    if (action === "validate") {
      const platform = String(body.platform || "").toLowerCase();
      if (!["leetcode", "github"].includes(platform)) return response({ error: "Unsupported platform" }, 400);
      return response(await validatePlatform(platform, cleanUsername(body.username), String(body.profile_link || "")));
    }
    if (action === "status") {
      const q = String(body.query || "").trim();
      if (!q) return response({ status: "NOT_FOUND" });
      const { data, error } = await admin.rpc("get_profile_status", { p_query: q });
      if (error) throw error;
      return response(data || { status: "NOT_FOUND" });
    }
    if (action === "submit") {
      const r = body.request || {};
      const register_number = String(r.register_number || "").trim();
      const student_name = String(r.student_name || "").trim();
      const year = Number(r.year);
      const department = String(r.department || "ECE").trim();
      const section = String(r.section || "").trim();
      const leetcode_username = cleanUsername(r.leetcode_username);
      const github_username = cleanUsername(r.github_username);
      const leetcode_link = String(r.leetcode_link || "").trim();
      const github_link = String(r.github_link || "").trim();
      if (!register_number || !student_name || ![1,2,3,4].includes(year) || !department || !section || !leetcode_username || !github_username) return response({ error: "Please complete all required fields." }, 400);
      const [lc, gh] = await Promise.all([validatePlatform("leetcode", leetcode_username, leetcode_link), validatePlatform("github", github_username, github_link)]);
      const { data: existing } = await admin.from("profile_requests").select("id,status").eq("register_number", register_number).in("status", ["Pending"]).maybeSingle();
      const payload = { register_number, student_name, year, department, section, leetcode_username, leetcode_link: lc.canonical_link, github_username, github_link: gh.canonical_link, status: "Pending", requested_at: new Date().toISOString(), processed_at: null, processed_by: null, admin_note: null };
      if (existing?.id) {
        const { error } = await admin.from("profile_requests").update(payload).eq("id", existing.id); if (error) throw error;
      } else {
        const { error } = await admin.from("profile_requests").insert(payload); if (error) throw error;
      }
      return response({ success: true, message: "Your profile request was submitted successfully. Both profiles were verified." });
    }
    return response({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("PROFILE REQUEST ERROR", e);
    return response({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
