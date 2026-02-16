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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active programs
    const { data: programs, error: progError } = await supabase
      .from("onboarding_programs")
      .select("*")
      .eq("status", "active");

    if (progError) throw progError;
    if (!programs || programs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active programs", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate expected day using business days (skip weekends)
    function getBusinessDaysBetween(startDate: string, today: Date): number {
      const start = new Date(startDate);
      let count = 0;
      const current = new Date(start);
      current.setDate(current.getDate() + 1); // Start counting from the day after start

      while (current <= today) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count;
    }

    const today = new Date();
    let sentCount = 0;

    for (const program of programs) {
      const businessDays = getBusinessDaysBetween(program.start_date, today);
      const expectedDay = Math.min(businessDays + 1, 20); // +1 because day 1 is the start day

      if (program.current_day >= expectedDay) continue; // On track

      // Check if we already sent a behind_schedule notification today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("related_program_id", program.id)
        .eq("type", "behind_schedule")
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existingNotif && existingNotif.length > 0) continue; // Already notified today

      // Get associate name
      const { data: associateProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", program.associate_id)
        .single();

      const name = associateProfile?.full_name || associateProfile?.email || "Associate";
      const body = `${name} is on Day ${program.current_day} but should be on Day ${expectedDay}. Please review and catch up.`;

      // Notify associate
      await supabase.from("notifications").insert({
        user_id: program.associate_id,
        type: "behind_schedule",
        title: "Onboarding Behind Schedule",
        body,
        related_program_id: program.id,
      });

      // Notify manager
      await supabase.from("notifications").insert({
        user_id: program.manager_id,
        type: "behind_schedule",
        title: "Onboarding Behind Schedule",
        body,
        related_program_id: program.id,
      });

      sentCount++;
    }

    return new Response(
      JSON.stringify({ message: "Behind schedule check complete", sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
