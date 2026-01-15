import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InactiveContact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  user_id: string
  last_engaged_at: string | null
  inactive_since: string | null
  reengagement_attempts: number
  engagement_score: number | null
  status: string
}

// Re-engagement thresholds
const INACTIVE_DAYS = 30 // Days without engagement to consider inactive
const MAX_REENGAGEMENT_ATTEMPTS = 3 // Maximum re-engagement attempts before marking as churned
const REENGAGEMENT_INTERVAL_DAYS = 7 // Days between re-engagement attempts

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Processing re-engagement campaigns...')

    const now = new Date()
    const inactiveCutoff = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const reengagementCooldown = new Date(now.getTime() - REENGAGEMENT_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Step 1: Identify newly inactive contacts (haven't engaged in INACTIVE_DAYS)
    // First, find contacts with email activity
    const { data: activeContacts, error: activeError } = await supabase
      .from('email_logs')
      .select('email, opened_at, clicked_at, campaign_id')
      .or('opened_at.not.is.null,clicked_at.not.is.null')
      .order('opened_at', { ascending: false })
      .limit(1000)

    if (activeError) {
      console.error('Error fetching active contacts:', activeError)
    }

    // Create a map of last engagement per email
    const lastEngagementMap = new Map<string, Date>()
    for (const log of activeContacts || []) {
      const engagementDate = new Date(log.clicked_at || log.opened_at)
      const existing = lastEngagementMap.get(log.email)
      if (!existing || engagementDate > existing) {
        lastEngagementMap.set(log.email, engagementDate)
      }
    }

    // Update contacts with their last engagement dates
    for (const [email, lastEngaged] of lastEngagementMap) {
      await supabase
        .from('contacts')
        .update({ 
          last_engaged_at: lastEngaged.toISOString(),
          engagement_score: 100 // Reset score on engagement
        })
        .eq('email', email)
        .is('suppressed', false)
    }

    // Step 2: Find contacts eligible for re-engagement
    // - Status is 'active' or 'inactive'
    // - Not suppressed
    // - Either never engaged or last engaged before cutoff
    // - Haven't had a re-engagement attempt in the cooldown period
    // - Haven't exceeded max attempts
    const { data: eligibleContacts, error: eligibleError } = await supabase
      .from('contacts')
      .select('*')
      .in('status', ['active', 'inactive'])
      .eq('suppressed', false)
      .lt('reengagement_attempts', MAX_REENGAGEMENT_ATTEMPTS)
      .or(`last_engaged_at.is.null,last_engaged_at.lt.${inactiveCutoff}`)
      .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${reengagementCooldown}`)
      .limit(100) as { data: InactiveContact[] | null, error: any }

    if (eligibleError) {
      console.error('Error fetching eligible contacts:', eligibleError)
      throw eligibleError
    }

    console.log(`Found ${eligibleContacts?.length || 0} contacts eligible for re-engagement`)

    const results = {
      contacts_processed: 0,
      newly_inactive: 0,
      reengagement_triggered: 0,
      marked_churned: 0,
      errors: [] as string[],
    }

    for (const contact of eligibleContacts || []) {
      try {
        // Mark as inactive if not already
        if (contact.status === 'active') {
          await supabase
            .from('contacts')
            .update({ 
              status: 'inactive',
              inactive_since: now.toISOString(),
              engagement_score: Math.max(0, (contact.engagement_score || 100) - 20)
            })
            .eq('id', contact.id)

          results.newly_inactive++
        }

        // Check if we should trigger a re-engagement campaign
        const attemptNumber = (contact.reengagement_attempts || 0) + 1

        if (attemptNumber > MAX_REENGAGEMENT_ATTEMPTS) {
          // Mark as churned
          await supabase
            .from('contacts')
            .update({ 
              status: 'churned',
              engagement_score: 0
            })
            .eq('id', contact.id)

          results.marked_churned++
          console.log(`Contact ${contact.email} marked as churned after ${MAX_REENGAGEMENT_ATTEMPTS} attempts`)
          continue
        }

        // Create re-engagement campaign record
        const { data: reengagementRecord, error: insertError } = await supabase
          .from('re_engagement_campaigns')
          .insert({
            user_id: contact.user_id,
            contact_id: contact.id,
            attempt_number: attemptNumber,
            status: 'pending',
          })
          .select()
          .single()

        if (insertError) {
          console.error(`Error creating re-engagement record for ${contact.email}:`, insertError)
          results.errors.push(`Failed to create record for ${contact.email}`)
          continue
        }

        // Update contact's re-engagement tracking
        await supabase
          .from('contacts')
          .update({
            reengagement_attempts: attemptNumber,
            last_reengagement_at: now.toISOString(),
            engagement_score: Math.max(0, (contact.engagement_score || 100) - 10)
          })
          .eq('id', contact.id)

        results.reengagement_triggered++
        console.log(`Re-engagement attempt #${attemptNumber} triggered for ${contact.email}`)

        // Here you would typically trigger the actual re-engagement email
        // This could be done via webhook, direct email send, or queued for batch processing
        // For now, we log it and mark the record
        
        await supabase
          .from('re_engagement_campaigns')
          .update({ 
            status: 'sent',
            sent_at: now.toISOString()
          })
          .eq('id', reengagementRecord.id)

        results.contacts_processed++
      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error)
        results.errors.push(`Error with contact ${contact.email}: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    // Step 3: Check for contacts who re-engaged after re-engagement campaigns
    const { data: reengagedContacts, error: reengagedError } = await supabase
      .from('contacts')
      .select('id, email, last_engaged_at')
      .eq('status', 'inactive')
      .not('last_engaged_at', 'is', null)
      .gt('last_engaged_at', reengagementCooldown)
      .limit(100)

    if (!reengagedError && reengagedContacts) {
      for (const contact of reengagedContacts) {
        // Re-activate the contact
        await supabase
          .from('contacts')
          .update({
            status: 'active',
            inactive_since: null,
            engagement_score: 100,
            reengagement_attempts: 0
          })
          .eq('id', contact.id)

        // Update the re-engagement campaign as successful
        await supabase
          .from('re_engagement_campaigns')
          .update({ 
            status: 'clicked',
            clicked_at: contact.last_engaged_at
          })
          .eq('contact_id', contact.id)
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(1)

        console.log(`Contact ${contact.email} re-engaged and reactivated`)
      }
    }

    console.log('Re-engagement processing complete:', results)

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Re-engagement processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})