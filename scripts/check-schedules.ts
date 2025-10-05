/**
 * Check schedules in the database
 * Usage: npx tsx scripts/check-schedules.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkSchedules() {
  console.log('🔍 Checking schedules in database...\n')

  // Get current time
  const now = new Date()
  console.log(`⏰ Current time: ${now.toISOString()} (${now.toLocaleString()})`)
  console.log('')

  // Fetch all schedules
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching schedules:', error)
    process.exit(1)
  }

  if (!schedules || schedules.length === 0) {
    console.log('ℹ️  No schedules found in database')
    return
  }

  console.log(`📋 Found ${schedules.length} schedule(s):\n`)

  schedules.forEach((schedule, idx) => {
    const nextExec = schedule.next_execution_at ? new Date(schedule.next_execution_at) : null
    const isDue = nextExec ? nextExec <= now : false
    
    console.log(`${idx + 1}. ${schedule.name}`)
    console.log(`   ID: ${schedule.id}`)
    console.log(`   Active: ${schedule.is_active ? '✅ Yes' : '❌ No'}`)
    console.log(`   Recurring: ${schedule.is_recurring ? '🔄 Yes' : '⏱️  One-time'}`)
    
    if (schedule.is_recurring) {
      console.log(`   Pattern: ${schedule.recurrence_pattern}`)
      if (schedule.recurrence_config) {
        console.log(`   Config: ${JSON.stringify(schedule.recurrence_config)}`)
      }
      if (schedule.max_executions) {
        console.log(`   Max Executions: ${schedule.max_executions}`)
      }
    }
    
    console.log(`   Execution Count: ${schedule.execution_count || 0}`)
    
    if (schedule.last_executed_at) {
      const lastExec = new Date(schedule.last_executed_at)
      console.log(`   Last Executed: ${lastExec.toISOString()} (${lastExec.toLocaleString()})`)
    }
    
    if (nextExec) {
      console.log(`   Next Execution: ${nextExec.toISOString()} (${nextExec.toLocaleString()})`)
      console.log(`   Is Due: ${isDue ? '🔴 YES - Should execute now!' : '🟢 No - Future'}`)
      
      if (isDue) {
        const minutesOverdue = Math.floor((now.getTime() - nextExec.getTime()) / 60000)
        console.log(`   ⚠️  OVERDUE by ${minutesOverdue} minute(s)!`)
      }
    }
    
    console.log(`   Webhook URL: ${schedule.webhook_url}`)
    console.log('')
  })

  // Check for due schedules
  const dueSchedules = schedules.filter(s => {
    if (!s.is_active) return false
    if (!s.next_execution_at) return false
    return new Date(s.next_execution_at) <= now
  })

  if (dueSchedules.length > 0) {
    console.log(`\n🔴 ${dueSchedules.length} schedule(s) are DUE for execution right now!`)
    console.log('These should be processed by the Edge Function on the next cron run.')
  } else {
    console.log('\n🟢 No schedules are currently due for execution')
  }
}

checkSchedules().catch(console.error)