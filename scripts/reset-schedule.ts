/**
 * Reset schedule to execute immediately (uses service role key)
 * Usage: npx tsx scripts/reset-schedule.ts <schedule-id>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL!')
  process.exit(1)
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY!')
  console.error('\nAdd this to your .env.local:')
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  console.error('\nGet it from: Supabase Dashboard > Project Settings > API > service_role key')
  process.exit(1)
}

const scheduleId = process.argv[2] || 'd75966da-abc7-4453-b0a6-0120b7724dff'

// Use service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetSchedule() {
  console.log(`🔧 Resetting schedule: ${scheduleId}\n`)

  // Check current state
  const { data: before, error: fetchError } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single()

  if (fetchError) {
    console.error('❌ Error fetching schedule:', fetchError.message)
    process.exit(1)
  }

  if (!before) {
    console.error('❌ Schedule not found')
    process.exit(1)
  }

  console.log('📊 Current state:')
  console.log(`   Name: ${before.name}`)
  console.log(`   Active: ${before.is_active}`)
  console.log(`   Recurring: ${before.is_recurring}`)
  console.log(`   Pattern: ${before.recurrence_pattern}`)
  console.log(`   Config: ${JSON.stringify(before.recurrence_config)}`)
  console.log(`   Execution Count: ${before.execution_count || 0}/${before.max_executions || '∞'}`)
  console.log(`   Next Execution: ${before.next_execution_at}`)
  
  const nextExec = new Date(before.next_execution_at)
  const now = new Date()
  const isDue = nextExec <= now
  
  console.log(`   Is Due: ${isDue ? '🔴 YES' : '🟢 No (future)'}`)
  
  if (!isDue) {
    const minutesUntil = Math.floor((nextExec.getTime() - now.getTime()) / 60000)
    console.log(`   ⏰ Will execute in ${minutesUntil} minute(s)`)
  }
  
  console.log('')

  // Update to NOW
  const { data: after, error: updateError } = await supabase
    .from('schedules')
    .update({ next_execution_at: now.toISOString() })
    .eq('id', scheduleId)
    .select()
    .single()

  if (updateError) {
    console.error('❌ Error updating schedule:', updateError.message)
    process.exit(1)
  }

  console.log('✅ Schedule updated!')
  console.log(`   Old Next Execution: ${before.next_execution_at}`)
  console.log(`   New Next Execution: ${after.next_execution_at}`)
  console.log('')
  console.log('⏱️  The schedule should execute within 1-2 minutes.')
  console.log('   Watch your Discord channel for the webhook message!')
  console.log('')
  console.log('🔍 To check execution status, run:')
  console.log(`   npx tsx scripts/check-schedule-status.ts ${scheduleId}`)
}

resetSchedule()