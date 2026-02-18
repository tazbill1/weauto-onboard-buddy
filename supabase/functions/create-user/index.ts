import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated admin/manager
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller's JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller role
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, store_id")
      .eq("user_id", caller.id)
      .single();

    const allowedRoles = ["sales_manager", "gm", "hr_admin", "corporate_admin"];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, role, storeId, fullName, managerId, autoStart } = await req.json();

    if (!email || !password || !role || !storeId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client to create the user
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation
      user_metadata: {
        role,
        store_id: storeId,
        full_name: fullName || "",
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with correct role and must_change_password
    // The handle_new_user trigger may downgrade role to 'associate' without an invite,
    // so we explicitly set the correct role here via the admin client.
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ must_change_password: true, role: role })
      .eq("user_id", newUser.user.id);

    if (profileError) {
      console.error("Failed to update profile:", profileError.message);
    }

    if (profileError) {
      console.error("Failed to set must_change_password:", profileError.message);
    }

    // Auto-start onboarding if requested
    if (role === "associate" && autoStart && managerId) {
      const { error: programError } = await adminClient
        .from("onboarding_programs")
        .insert({
          associate_id: newUser.user.id,
          manager_id: managerId,
          store_id: storeId,
          status: "active",
        });
      if (programError) {
        console.error("Failed to create onboarding program:", programError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-user error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
