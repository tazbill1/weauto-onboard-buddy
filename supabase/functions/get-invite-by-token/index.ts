import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invite, error } = await supabase
      .from("invites")
      .select("email, role, store_id, status, expires_at, auto_start_onboarding, assigned_manager_id, department_id, stores(store_name)")
      .eq("token", token)
      .maybeSingle();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ status: "invalid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine status
    let resolvedStatus: string;
    if (invite.status === "accepted") {
      resolvedStatus = "accepted";
    } else if (invite.status === "revoked") {
      resolvedStatus = "invalid";
    } else if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
      resolvedStatus = "expired";
    } else if (invite.status === "pending") {
      resolvedStatus = "valid";
    } else {
      resolvedStatus = "invalid";
    }

    return new Response(
      JSON.stringify({
        status: resolvedStatus,
        email: invite.email,
        role: invite.role,
        store_id: invite.store_id,
        store_name: (invite.stores as any)?.store_name || null,
        auto_start_onboarding: invite.auto_start_onboarding,
        assigned_manager_id: invite.assigned_manager_id,
        department_id: invite.department_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
