import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  try {
    const { identifier, password } = await req.json();
    const id = String(identifier ?? "").trim();
    if (!id || typeof password !== "string" || password.length < 1 || id.length > 254) return new Response(JSON.stringify({ error: "Enter your login ID and password." }), { status: 400, headers: cors });
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let email = "";
    if (id.includes("@")) {
      // Email login is passed through directly; Auth verifies the password without revealing account existence.
      email = id.toLowerCase();
    } else {
      let profile = null;
      if (/^[0-9]{6,20}$/.test(id)) {
        const result = await admin.from("campus360_student_profiles").select("college_email").eq("reg_no", id).maybeSingle();
        profile = result.data;
      } else if (/^[A-Za-z0-9._-]{4,24}$/.test(id)) {
        const result = await admin.from("campus360_student_profiles").select("college_email").eq("username", id.toLowerCase()).maybeSingle();
        profile = result.data;
      }
      if (profile?.college_email) email = profile.college_email;
      else email = "";
    }
    if (!email) return new Response(JSON.stringify({ error: "Invalid login ID or password." }), { status: 401, headers: cors });
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) return new Response(JSON.stringify({ error: "Invalid login ID or password." }), { status: 401, headers: cors });
    return new Response(JSON.stringify({ session: data.session, user: data.user }), { status: 200, headers: cors });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Sign in could not be completed. Try again shortly." }), { status: 500, headers: cors });
  }
});
