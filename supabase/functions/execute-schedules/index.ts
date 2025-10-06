import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseAndCalculateNext } from './cron-parser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const now = new Date()
    console.log(`[${now.toISOString()}] Checking for due schedules...`)

    // Fetch schedules that are due for execution
    const { data: schedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_execution_at', now.toISOString())
      .order('next_execution_at', { ascending: true })
      .limit(100) // Process in batches

    if (fetchError) {
      console.error('Error fetching schedules:', fetchError)
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!schedules || schedules.length === 0) {
      console.log('No schedules due for execution')
      return new Response(
        JSON.stringify({ processed: 0, message: 'No schedules due' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Found ${schedules.length} schedule(s) to process`)

    const results = []

    for (const schedule of schedules) {
      try {
        console.log(`Processing schedule: ${schedule.id} (${schedule.name})`)

        // Send webhook
        const response = await fetch(schedule.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schedule.message_data)
        })

        const success = response.ok
        const newExecutionCount = (schedule.execution_count || 0) + 1

        console.log(`Webhook ${success ? 'sent successfully' : 'failed'} for schedule ${schedule.id}`)

        // Determine if schedule should continue
        const shouldContinue = schedule.is_recurring

        const updateData: any = {
          last_executed_at: now.toISOString(),
          execution_count: newExecutionCount,
          updated_at: now.toISOString()
        }

        if (shouldContinue) {
          // Calculate next execution time based on pattern
          let nextExecution: Date

          if (schedule.recurrence_pattern === 'cron' && schedule.recurrence_config?.cronExpression) {
            // For cron schedules, use the cron parser
            nextExecution = parseAndCalculateNext(schedule.recurrence_config.cronExpression, now)
          } else {
            // For once schedules or fallback, mark as inactive
            updateData.is_active = false
            console.log(`Schedule ${schedule.id} marked as inactive`)
            continue
          }

          updateData.next_execution_at = nextExecution.toISOString()
          console.log(`Next execution scheduled for: ${nextExecution.toISOString()}`)
        } else {
          // Deactivate one-time schedules
          updateData.is_active = false
          console.log(`Schedule ${schedule.id} marked as inactive`)
        }

        // Update schedule
        const { error: updateError } = await supabase
          .from('schedules')
          .update(updateData)
          .eq('id', schedule.id)

        if (updateError) {
          console.error(`Error updating schedule ${schedule.id}:`, updateError)
        }

        results.push({
          id: schedule.id,
          name: schedule.name,
          success,
          status: response.status,
          continues: shouldContinue,
          nextExecution: shouldContinue ? updateData.next_execution_at : null
        })

      } catch (error) {
        console.error(`Error executing schedule ${schedule.id}:`, error)
        results.push({
          id: schedule.id,
          name: schedule.name,
          success: false,
          error: error.message
        })
      }
    }

    console.log(`Processed ${results.length} schedule(s)`)

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
        timestamp: now.toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Calculate the next execution time for a recurring schedule
 */
function calculateNextExecution(
  pattern: string,
  config: any,
  fromDate: Date
): Date {
  const next = new Date(fromDate)

  switch (pattern) {
    case 'once':
      return next

    case 'daily':
      next.setDate(next.getDate() + 1)
      if (config?.time) {
        const [hours, minutes] = config.time.split(':').map(Number)
        next.setHours(hours, minutes, 0, 0)
      }
      break

    case 'weekly':
      if (config?.days && config.days.length > 0) {
        const currentDay = next.getDay()
        const sortedDays = [...config.days].sort()

        // Find next day in the week
        let nextDay = sortedDays.find((d: number) => d > currentDay)

        if (nextDay === undefined) {
          // Wrap to next week
          nextDay = sortedDays[0]
          next.setDate(next.getDate() + (7 - currentDay + nextDay))
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay))
        }

        if (config.time) {
          const [hours, minutes] = config.time.split(':').map(Number)
          next.setHours(hours, minutes, 0, 0)
        }
      }
      break

    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      if (config?.day) {
        next.setDate(config.day)
      }
      if (config?.time) {
        const [hours, minutes] = config.time.split(':').map(Number)
        next.setHours(hours, minutes, 0, 0)
      }
      break

    case 'custom':
      // Use cron parser for custom patterns
      if (config?.cronExpression) {
        return parseAndCalculateNext(config.cronExpression, fromDate)
      }
      // Fallback to +1 day if no cron expression
      next.setDate(next.getDate() + 1)
      break

    default:
      // Default to +1 day
      next.setDate(next.getDate() + 1)
  }

  return next
}