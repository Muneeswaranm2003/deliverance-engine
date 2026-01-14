import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  campaign_id?: string;
  recipient_id?: string;
}

interface EmailSettings {
  provider_type: "api" | "smtp";
  api_provider?: string;
  api_key?: string;
  api_from_email?: string;
  api_from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_encryption?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  use_dedicated_ip?: boolean;
  ip_pool?: string;
  enable_ip_warmup?: boolean;
  daily_warmup_limit?: number;
}

async function sendViaResend(settings: EmailSettings, email: EmailRequest): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = settings.api_key;
  if (!apiKey) {
    return { success: false, error: "Resend API key not configured" };
  }

  const resend = new Resend(apiKey);
  
  const fromEmail = email.from_email || settings.api_from_email || "onboarding@resend.dev";
  const fromName = email.from_name || settings.api_from_name || "Lovable";
  
  try {
    const response = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      reply_to: email.reply_to,
    });

    console.log("Resend response:", response);
    
    if (response.error) {
      return { success: false, error: response.error.message };
    }
    
    return { success: true, messageId: response.data?.id };
  } catch (error: any) {
    console.error("Resend error:", error);
    return { success: false, error: error.message };
  }
}

async function sendViaSMTP(settings: EmailSettings, email: EmailRequest): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Note: SMTP sending in Deno requires additional setup
  // For now, we'll return an error suggesting to use API instead
  // In production, you'd use a library like nodemailer or similar
  
  const { smtp_host, smtp_port, smtp_username, smtp_password } = settings;
  
  if (!smtp_host || !smtp_username || !smtp_password) {
    return { success: false, error: "SMTP settings incomplete" };
  }

  // SMTP implementation would go here
  // For Deno, you could use: https://deno.land/x/smtp
  return { 
    success: false, 
    error: "SMTP sending is not yet implemented. Please use API-based sending with Resend, SendGrid, or similar providers." 
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRequest: EmailRequest = await req.json();
    const recipientEmails = Array.isArray(emailRequest.to) ? emailRequest.to : [emailRequest.to];

    // Check suppression list for each recipient
    const { data: suppressedEmails } = await supabase
      .from("suppression_list")
      .select("email")
      .eq("user_id", user.id)
      .in("email", recipientEmails.map(e => e.toLowerCase()));

    const suppressedSet = new Set((suppressedEmails || []).map(s => s.email.toLowerCase()));
    const validRecipients = recipientEmails.filter(e => !suppressedSet.has(e.toLowerCase()));
    const skippedRecipients = recipientEmails.filter(e => suppressedSet.has(e.toLowerCase()));

    if (skippedRecipients.length > 0) {
      console.log(`Skipping suppressed recipients: ${skippedRecipients.join(", ")}`);
    }

    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "All recipients are suppressed",
          suppressed: skippedRecipients 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update email request with valid recipients only
    emailRequest.to = validRecipients;

    // Fetch user's email settings
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching email settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch email settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings) {
      return new Response(
        JSON.stringify({ error: "Email settings not configured. Please configure your email settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { success: boolean; messageId?: string; error?: string };

    if (settings.provider_type === "api") {
      // Currently only Resend is fully supported
      if (settings.api_provider === "resend" || !settings.api_provider) {
        result = await sendViaResend(settings as EmailSettings, emailRequest);
      } else {
        // For other providers, we'd need to implement their SDKs
        result = { 
          success: false, 
          error: `Provider ${settings.api_provider} is not yet supported. Please use Resend.` 
        };
      }
    } else {
      result = await sendViaSMTP(settings as EmailSettings, emailRequest);
    }

    // Log the email send attempt
    if (emailRequest.campaign_id) {
      const logData = {
        campaign_id: emailRequest.campaign_id,
        recipient_id: emailRequest.recipient_id || null,
        email: Array.isArray(emailRequest.to) ? emailRequest.to[0] : emailRequest.to,
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      };

      await supabase.from("email_logs").insert(logData);
    }

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
