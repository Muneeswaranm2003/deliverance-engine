import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Automation {
  id: string
  user_id: string
  name: string
  type: string
  trigger: string
  action: string
  delay: string | null
  enabled: boolean
  webhook_url: string | null
  triggered_count: number
  completed_count: number
}

// Convert delay string to milliseconds
function delayToMs(delay: string): number {
  const delayMap: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '2d': 2 * 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
  }
  return delayMap[delay] || 24 * 60 * 60 * 1000 // Default to 1 day
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Processing scheduled automations...')

    // Get all enabled automations with time-based triggers
    const { data: automations, error: automationsError } = await supabase
      .from('automations')
      .select('*')
      .eq('enabled', true)
      .in('trigger', ['not_opened', 'no_reply', 'opened_no_click'])

    if (automationsError) {
      console.error('Error fetching automations:', automationsError)
      throw automationsError
    }

    console.log(`Found ${automations?.length || 0} time-based automations to process`)

    const results: { automation_id: string; contacts_processed: number; errors: string[] }[] = []

    for (const automation of automations || []) {
      const automationResult = {
        automation_id: automation.id,
        contacts_processed: 0,
        errors: [] as string[],
      }

      try {
        const delayMs = delayToMs(automation.delay || '1d')
        const cutoffTime = new Date(Date.now() - delayMs).toISOString()

        // Find emails that match the trigger condition
        let query = supabase
          .from('email_logs')
          .select(`
            id,
            campaign_id,
            email,
            recipient_id,
            status,
            sent_at,
            opened_at,
            clicked_at,
            campaigns!inner(user_id)
          `)
          .eq('campaigns.user_id', automation.user_id)
          .not('sent_at', 'is', null)
          .lt('sent_at', cutoffTime)

        // Apply trigger-specific filters
        if (automation.trigger === 'not_opened') {
          query = query.is('opened_at', null).neq('status', 'bounced').neq('status', 'failed')
        } else if (automation.trigger === 'opened_no_click') {
          query = query.not('opened_at', 'is', null).is('clicked_at', null)
        } else if (automation.trigger === 'no_reply') {
          // For no_reply, we check emails that were sent but no response
          query = query.is('opened_at', null)
        }

        const { data: eligibleEmails, error: emailsError } = await query.limit(100)

        if (emailsError) {
          console.error(`Error fetching emails for automation ${automation.id}:`, emailsError)
          automationResult.errors.push(emailsError.message)
          continue
        }

        console.log(`Found ${eligibleEmails?.length || 0} eligible emails for automation: ${automation.name}`)

        // Check which emails have already been processed by this automation
        for (const emailLog of eligibleEmails || []) {
          // Check if we already triggered this automation for this email
          const { data: existingLog } = await supabase
            .from('automation_logs')
            .select('id')
            .eq('automation_id', automation.id)
            .eq('webhook_event_id', emailLog.id)
            .maybeSingle()

          if (existingLog) {
            // Already processed
            continue
          }

          // Create a webhook event for tracking
          const { data: webhookEvent, error: eventError } = await supabase
            .from('webhook_events')
            .insert({
              campaign_id: emailLog.campaign_id,
              event_type: `scheduled.${automation.trigger}`,
              email: emailLog.email,
              recipient_id: emailLog.recipient_id,
              payload: {
                automation_id: automation.id,
                automation_name: automation.name,
                delay: automation.delay,
                email_log_id: emailLog.id,
              },
            })
            .select()
            .single()

          if (eventError) {
            console.error('Error creating webhook event:', eventError)
            automationResult.errors.push(`Failed to create event for ${emailLog.email}`)
            continue
          }

          // Log the automation execution
          const { error: logError } = await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            webhook_event_id: webhookEvent.id,
            status: 'pending',
          })

          if (logError) {
            console.error('Error creating automation log:', logError)
          }

          // Execute the action
          let actionSuccess = false

          if (automation.action === 'webhook' && automation.webhook_url) {
            try {
              await fetch(automation.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  automation_id: automation.id,
                  automation_name: automation.name,
                  trigger: automation.trigger,
                  campaign_id: emailLog.campaign_id,
                  email: emailLog.email,
                  recipient_id: emailLog.recipient_id,
                  delay: automation.delay,
                  triggered_at: new Date().toISOString(),
                }),
              })
              actionSuccess = true
            } catch (webhookError) {
              console.error('Webhook call failed:', webhookError)
              automationResult.errors.push(`Webhook failed for ${emailLog.email}`)
            }
          } else if (automation.action === 'send_email') {
            // For send_email action, we would integrate with email service
            // For now, just log it as a pending action
            console.log(`Would send follow-up email to ${emailLog.email}`)
            actionSuccess = true
          } else if (automation.action === 'add_tag' || automation.action === 'move_list' || automation.action === 'notify') {
            // These actions would need additional implementation
            console.log(`Action ${automation.action} triggered for ${emailLog.email}`)
            actionSuccess = true
          }

          // Update automation log status
          await supabase
            .from('automation_logs')
            .update({ status: actionSuccess ? 'completed' : 'failed' })
            .eq('automation_id', automation.id)
            .eq('webhook_event_id', webhookEvent.id)

          // Mark webhook event as processed
          await supabase
            .from('webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('id', webhookEvent.id)

          automationResult.contacts_processed++
        }

        // Update automation counts
        if (automationResult.contacts_processed > 0) {
          await supabase
            .from('automations')
            .update({
              triggered_count: (automation.triggered_count || 0) + automationResult.contacts_processed,
              completed_count: (automation.completed_count || 0) + automationResult.contacts_processed,
            })
            .eq('id', automation.id)
        }
      } catch (error) {
        console.error(`Error processing automation ${automation.id}:`, error)
        automationResult.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }

      results.push(automationResult)
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.contacts_processed, 0)
    console.log(`Scheduled automation processing complete. Total contacts processed: ${totalProcessed}`)

    return new Response(
      JSON.stringify({
        success: true,
        automations_checked: automations?.length || 0,
        total_contacts_processed: totalProcessed,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Scheduled automation processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
