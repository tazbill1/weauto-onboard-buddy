import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendEmail(to: string, subject: string, body: string, notificationId: string | undefined, supabase: any) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return;

  const appUrl = Deno.env.get("APP_URL") || "https://id-preview--56e54c4e-d633-4381-af92-124ccaa0d16d.lovable.app";

  const htmlEmail = `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Inter,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:32px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);"><tr><td style="background-color:#1e3a5f;padding:24px 32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">WEAuto</h1><p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">Onboarding Program</p></td></tr><tr><td style="padding:32px;"><h2 style="margin:0 0 12px;color:#1e3a5f;font-size:18px;font-weight:700;">${subject}</h2><p style="margin:0 0 24px;color:#4a5568;font-size:14px;line-height:1.6;">${body}</p><a href="${appUrl}/notifications" style="display:inline-block;background-color:#2b6cb0;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">View in App</a></td></tr><tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#a0aec0;font-size:11px;">Automated notification from WEAuto Onboarding.</p></td></tr></table></td></tr></table></body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "WEAuto Onboarding <onboarding@resend.dev>", to: [to], subject: `WEAuto: ${subject}`, html: htmlEmail }),
    });
    if (res.ok && notificationId) {
      await supabase.from("notifications").update({ is_emailed: true }).eq("id", notificationId);
    }
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

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
    // This function should only be called by cron/scheduler.
    // Validate via Authorization header matching the anon key (from cron) or service role key.
    const authHeader = req.headers.get("Authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const bearerToken = authHeader?.replace("Bearer ", "") || "";

    if (bearerToken !== anonKey && bearerToken !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    function getBusinessDaysBetween(startDate: string, today: Date): number {
      const start = new Date(startDate);
      let count = 0;
      const current = new Date(start);
      current.setDate(current.getDate() + 1);

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
      const expectedDay = Math.min(businessDays + 1, 20);

      if (program.current_day >= expectedDay) continue;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("related_program_id", program.id)
        .eq("type", "behind_schedule")
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existingNotif && existingNotif.length > 0) continue;

      const { data: associateProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", program.associate_id)
        .single();

      const name = associateProfile?.full_name || associateProfile?.email || "Associate";
      const body = `${name} is on Day ${program.current_day} but should be on Day ${expectedDay}. Please review and catch up.`;

      const { data: assocNotif } = await supabase.from("notifications").insert({
        user_id: program.associate_id,
        type: "behind_schedule",
        title: "Onboarding Behind Schedule",
        body,
        related_program_id: program.id,
      }).select("id").single();

      const { data: mgrNotif } = await supabase.from("notifications").insert({
        user_id: program.manager_id,
        type: "behind_schedule",
        title: "Onboarding Behind Schedule",
        body,
        related_program_id: program.id,
      }).select("id").single();

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        if (associateProfile?.email) {
          await sendEmail(associateProfile.email, "Onboarding Behind Schedule", body, assocNotif?.id, supabase);
        }
        const { data: managerProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", program.manager_id)
          .single();
        if (managerProfile?.email) {
          await sendEmail(managerProfile.email, "Onboarding Behind Schedule", body, mgrNotif?.id, supabase);
        }
      }

      sentCount++;
    }

    return new Response(
      JSON.stringify({ message: "Behind schedule check complete", sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
