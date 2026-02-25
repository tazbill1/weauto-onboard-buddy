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
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is corporate_admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin.rpc("get_user_role", { _user_id: user.id });
    if (roleData !== "corporate_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if master sales template already exists
    const { data: existing } = await supabaseAdmin
      .from("program_templates")
      .select("id")
      .eq("is_master", true)
      .eq("name", "WEAuto Sales Onboarding")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Master sales template already exists", template_id: existing.id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get sales department
    const { data: salesDept } = await supabaseAdmin
      .from("departments")
      .select("id")
      .eq("slug", "sales")
      .single();

    if (!salesDept) {
      return new Response(JSON.stringify({ error: "Sales department not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the template
    const { data: template, error: templateErr } = await supabaseAdmin
      .from("program_templates")
      .insert({
        name: "WEAuto Sales Onboarding",
        department_id: salesDept.id,
        description: "The standard 20-day WEAuto sales associate onboarding program.",
        total_days: 20,
        created_by: user.id,
        is_master: true,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (templateErr) throw templateErr;

    // Get all sales days (global ones with store_id IS NULL)
    const { data: days, error: daysErr } = await supabaseAdmin
      .from("days")
      .select("*")
      .eq("department_id", salesDept.id)
      .is("store_id", null)
      .order("day_number");

    if (daysErr) throw daysErr;

    if (!days || days.length === 0) {
      return new Response(
        JSON.stringify({ template_id: template.id, days_migrated: 0, tasks_migrated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create template days
    const templateDays = days.map((d: any) => ({
      template_id: template.id,
      day_number: d.day_number,
      title: d.title,
      subtitle: d.subtitle,
      phase: d.phase,
      sort_order: d.day_number,
    }));

    const { data: insertedDays, error: insertDaysErr } = await supabaseAdmin
      .from("template_days")
      .insert(templateDays)
      .select("id, day_number");

    if (insertDaysErr) throw insertDaysErr;

    // Build day_id -> template_day_id map
    const dayIdToTemplateDayId: Record<string, string> = {};
    for (const day of days) {
      const td = insertedDays?.find((td: any) => td.day_number === day.day_number);
      if (td) dayIdToTemplateDayId[day.id] = td.id;
    }

    // Get all tasks for these days
    const dayIds = days.map((d: any) => d.id);
    const { data: tasks, error: tasksErr } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .in("day_id", dayIds)
      .order("sort_order");

    if (tasksErr) throw tasksErr;

    let tasksMigrated = 0;
    if (tasks && tasks.length > 0) {
      const templateTasks = tasks.map((t: any) => ({
        template_day_id: dayIdToTemplateDayId[t.day_id],
        section: t.section,
        title: t.title,
        description: t.description,
        content_html: t.content_html,
        requires_upload: t.requires_upload,
        requires_rating: t.requires_rating,
        sort_order: t.sort_order,
      })).filter((t: any) => t.template_day_id);

      const { error: insertTasksErr } = await supabaseAdmin
        .from("template_tasks")
        .insert(templateTasks);

      if (insertTasksErr) throw insertTasksErr;
      tasksMigrated = templateTasks.length;
    }

    return new Response(
      JSON.stringify({
        template_id: template.id,
        days_migrated: insertedDays?.length || 0,
        tasks_migrated: tasksMigrated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
