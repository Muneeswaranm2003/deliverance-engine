import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  event_type: string
  campaign_id: string
  email: string
  recipient_id?: string
  timestamp?: string
  metadata?: Record<string, unknown>
}

const EVENT_TO_TRIGGER_MAP: Record<string, string> = {
  'email.opened': 'email_opened',
  'email.clicked': 'link_clicked',
  'email.bounced': 'bounced',
  'email.delivered': 'delivered',
  'email.sent': 'sent',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: WebhookPayload = await req.json()
    console.log('Received webhook event:', payload)

    // Validate required fields
    if (!payload.event_type || !payload.campaign_id || !payload.email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event_type, campaign_id, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store the webhook event
    const { data: webhookEvent, error: eventError } = await supabase
      .from('webhook_events')
      .insert({
        campaign_id: payload.campaign_id,
        event_type: payload.event_type,
        email: payload.email,
        recipient_id: payload.recipient_id || null,
        payload: payload.metadata || {},
      })
      .select()
      .single()

    if (eventError) {
      console.error('Error storing webhook event:', eventError)
      return new Response(
        JSON.stringify({ error: 'Failed to store event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update email_logs based on event type
    if (payload.event_type === 'email.opened') {
      await supabase
        .from('email_logs')
        .update({ status: 'opened', opened_at: new Date().toISOString() })
        .eq('campaign_id', payload.campaign_id)
        .eq('email', payload.email)
    } else if (payload.event_type === 'email.clicked') {
      await supabase
        .from('email_logs')
        .update({ status: 'clicked', clicked_at: new Date().toISOString() })
        .eq('campaign_id', payload.campaign_id)
        .eq('email', payload.email)
    } else if (payload.event_type === 'email.bounced') {
      await supabase
        .from('email_logs')
        .update({ status: 'bounced' })
        .eq('campaign_id', payload.campaign_id)
        .eq('email', payload.email)
    } else if (payload.event_type === 'email.delivered') {
      await supabase
        .from('email_logs')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('campaign_id', payload.campaign_id)
        .eq('email', payload.email)
    }

    // Find matching automations for this event
    const triggerType = EVENT_TO_TRIGGER_MAP[payload.event_type]
    if (triggerType) {
      // Get the campaign owner to find their automations
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('user_id')
        .eq('id', payload.campaign_id)
        .single()

      if (campaign) {
        const { data: automations } = await supabase
          .from('automations')
          .select('*')
          .eq('user_id', campaign.user_id)
          .eq('trigger', triggerType)
          .eq('enabled', true)

        // Execute each matching automation
        for (const automation of automations || []) {
          console.log(`Triggering automation: ${automation.name}`)

          // Log the automation execution
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            webhook_event_id: webhookEvent.id,
            status: 'pending',
          })

          // Increment triggered count
          await supabase
            .from('automations')
            .update({ triggered_count: (automation.triggered_count || 0) + 1 })
            .eq('id', automation.id)

          // Execute the action based on type
          if (automation.action === 'webhook' && automation.webhook_url) {
            try {
              await fetch(automation.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  automation_id: automation.id,
                  automation_name: automation.name,
                  event_type: payload.event_type,
                  campaign_id: payload.campaign_id,
                  email: payload.email,
                  triggered_at: new Date().toISOString(),
                }),
              })

              // Mark as completed
              await supabase
                .from('automation_logs')
                .update({ status: 'completed' })
                .eq('automation_id', automation.id)
                .eq('webhook_event_id', webhookEvent.id)

              await supabase
                .from('automations')
                .update({ completed_count: (automation.completed_count || 0) + 1 })
                .eq('id', automation.id)
            } catch (webhookError) {
              console.error('Webhook execution failed:', webhookError)
              await supabase
                .from('automation_logs')
                .update({ 
                  status: 'failed',
                  error_message: webhookError instanceof Error ? webhookError.message : 'Unknown error'
                })
                .eq('automation_id', automation.id)
                .eq('webhook_event_id', webhookEvent.id)
            }
          } else if (automation.action === 'notify') {
            // For notify action, just log it as completed (could integrate with push notifications)
            await supabase
              .from('automation_logs')
              .update({ status: 'completed' })
              .eq('automation_id', automation.id)
              .eq('webhook_event_id', webhookEvent.id)

            await supabase
              .from('automations')
              .update({ completed_count: (automation.completed_count || 0) + 1 })
              .eq('id', automation.id)
          } else {
            // Mark other actions as completed for now
            await supabase
              .from('automation_logs')
              .update({ status: 'completed' })
              .eq('automation_id', automation.id)
              .eq('webhook_event_id', webhookEvent.id)

            await supabase
              .from('automations')
              .update({ completed_count: (automation.completed_count || 0) + 1 })
              .eq('id', automation.id)
          }
        }
      }
    }

    // Mark event as processed
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', webhookEvent.id)

    return new Response(
      JSON.stringify({ success: true, event_id: webhookEvent.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
