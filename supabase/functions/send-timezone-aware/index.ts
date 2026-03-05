import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get the current hour in a given IANA timezone
function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    return -1 // Invalid timezone
  }
}

// Generate a random minute offset for spreading sends across the business window
function getRandomMinuteDelay(maxHours: number): number {
  return Math.floor(Math.random() * maxHours * 60) // random minutes within window
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Processing timezone-aware email queue...')

    // Get all campaigns that are in "sending" status
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'sending')

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      throw campaignsError
    }

    console.log(`Found ${campaigns?.length || 0} active campaigns`)

    let totalQueued = 0
    let totalSentNow = 0

    for (const campaign of campaigns || []) {
      // Get recipients who haven't been sent to yet
      const { data: pendingLogs, error: logsError } = await supabase
        .from('email_logs')
        .select(`
          id,
          email,
          recipient_id,
          status
        `)
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .limit(campaign.batch_size || 50)

      if (logsError) {
        console.error(`Error fetching pending logs for campaign ${campaign.id}:`, logsError)
        continue
      }

      if (!pendingLogs || pendingLogs.length === 0) {
        // No more pending emails - mark campaign as sent
        await supabase
          .from('campaigns')
          .update({ status: 'sent' })
          .eq('id', campaign.id)
        console.log(`Campaign ${campaign.id} completed - all emails sent`)
        continue
      }

      for (const log of pendingLogs) {
        // Look up the contact's timezone
        const { data: contact } = await supabase
          .from('contacts')
          .select('timezone, country')
          .eq('email', log.email)
          .eq('user_id', campaign.user_id)
          .maybeSingle()

        const contactTimezone = contact?.timezone || 'UTC'
        const currentHour = getCurrentHourInTimezone(contactTimezone)

        // Business hours: 10 AM to 4 PM (10-15, since at 16:00 we stop)
        const BUSINESS_START = 10
        const BUSINESS_END = 16

        if (currentHour >= BUSINESS_START && currentHour < BUSINESS_END) {
          // Within business hours - send now (with random delay within current hour)
          console.log(`Sending to ${log.email} (timezone: ${contactTimezone}, hour: ${currentHour})`)

          // Call the send-email function
          try {
            const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                to: log.email,
                subject: campaign.subject,
                html: campaign.content,
                from_email: campaign.sender_email,
                from_name: campaign.sender_name,
                campaign_id: campaign.id,
                recipient_id: log.recipient_id,
              }),
            })

            const result = await sendResponse.json()
            if (result.success) {
              totalSentNow++
              // Update email log status
              await supabase
                .from('email_logs')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', log.id)
            } else {
              console.error(`Failed to send to ${log.email}:`, result.error)
              await supabase
                .from('email_logs')
                .update({ status: 'failed', error_message: result.error })
                .eq('id', log.id)
            }
          } catch (sendError) {
            console.error(`Error sending to ${log.email}:`, sendError)
          }
        } else {
          // Outside business hours - skip, will be picked up in next run
          totalQueued++
          console.log(`Queued ${log.email} (timezone: ${contactTimezone}, hour: ${currentHour}) - outside business hours`)
        }
      }

      // Update sent count
      const { count } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'sent')

      await supabase
        .from('campaigns')
        .update({ sent_count: count || 0 })
        .eq('id', campaign.id)
    }

    console.log(`Timezone-aware processing complete. Sent: ${totalSentNow}, Queued for later: ${totalQueued}`)

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_processed: campaigns?.length || 0,
        sent_now: totalSentNow,
        queued_for_later: totalQueued,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Timezone-aware sending error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
