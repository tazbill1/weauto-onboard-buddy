import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  notificationId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // This function is called from DB triggers (via net.http_post with anon key)
    // and potentially from client. Validate the caller via Authorization header.
    const authHeader = req.headers.get("Authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // If called with anon key from DB trigger, allow but validate notificationId exists
    // If called with user JWT, validate user owns the notification
    let callerUserId: string | null = null;
    const bearerToken = authHeader?.replace("Bearer ", "") || "";

    if (bearerToken && bearerToken !== anonKey) {
      // User JWT - validate
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(bearerToken);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      callerUserId = claimsData.claims.sub as string;
    }

    const { to, subject, body, notificationId } = (await req.json()) as EmailPayload;

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate notificationId exists and matches caller if user JWT
    if (notificationId) {
      const { data: notif, error: notifError } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("id", notificationId)
        .single();

      if (notifError || !notif) {
        return new Response(
          JSON.stringify({ error: "Invalid notification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If called by a user (not trigger), verify ownership
      if (callerUserId && notif.user_id !== callerUserId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!bearerToken || bearerToken === anonKey) {
      // No notificationId and called from trigger — this shouldn't happen normally
      // but allow for backwards compat with trigger calls
    } else if (callerUserId) {
      // User calling without notificationId — reject
      return new Response(
        JSON.stringify({ error: "notificationId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://id-preview--56e54c4e-d633-4381-af92-124ccaa0d16d.lovable.app";

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color: #1e3a5f; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">WEAuto</h1>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 12px; font-weight: 500;">Onboarding Program</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px; color: #1e3a5f; font-size: 18px; font-weight: 700;">${subject}</h2>
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 14px; line-height: 1.6;">${body}</p>
              <a href="${appUrl}/notifications" style="display: inline-block; background-color: #2b6cb0; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">View in App</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px;">This is an automated notification from WEAuto Onboarding.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "WEAuto Onboarding <onboarding@resend.dev>",
        to: [to],
        subject: `WEAuto: ${subject}`,
        html: htmlEmail,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Email send failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (notificationId) {
      await supabase
        .from("notifications")
        .update({ is_emailed: true })
        .eq("id", notificationId);
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
