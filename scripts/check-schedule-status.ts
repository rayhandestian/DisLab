/**
 * Check specific schedule status with service role key
 * Usage: npx tsx scripts/check-schedule-status.ts <schedule-id>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local')
  process.exit(1)
}

const scheduleId = process.argv[2] || 'd75966da-abc7-4453-b0a6-0120b7724dff'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkStatus() {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single()

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  const now = new Date()
  const nextExec = data.next_execution_at ? new Date(data.next_execution_at) : null
  const isDue = nextExec ? nextExec <= now : false

  console.log('📊 Schedule Status\n')
  console.log(`ID: ${data.id}`)
  console.log(`Name: ${data.name}`)
  console.log(`Active: ${data.is_active ? '✅ Yes' : '❌ No'}`)
  console.log(`Recurring: ${data.is_recurring ? '🔄 Yes' : '⏱️  One-time'}`)
  console.log('')
  
  if (data.is_recurring) {
    console.log(`Pattern: ${data.recurrence_pattern}`)
    console.log(`Config: ${JSON.stringify(data.recurrence_config, null, 2)}`)
    if (data.cron_expression) {
      console.log(`Cron: ${data.cron_expression}`)
    }
    console.log('')
  }

  console.log(`Executions: ${data.execution_count || 0}${data.max_executions ? `/${data.max_executions}` : ''}`)
  
  if (data.last_executed_at) {
    const lastExec = new Date(data.last_executed_at)
    console.log(`Last Executed: ${lastExec.toISOString()}`)
    console.log(`               (${lastExec.toLocaleString()})`)
  } else {
    console.log(`Last Executed: Never`)
  }
  
  console.log('')
  console.log(`Current Time:  ${now.toISOString()}`)
  console.log(`               (${now.toLocaleString()})`)
  
  if (nextExec) {
    console.log(`Next Execution: ${nextExec.toISOString()}`)
    console.log(`                (${nextExec.toLocaleString()})`)
    console.log('')
    console.log(`Status: ${isDue ? '🔴 DUE NOW - Should execute!' : '🟢 Future'}`)
    
    if (isDue) {
      const minutesOverdue = Math.floor((now.getTime() - nextExec.getTime()) / 60000)
      console.log(`⚠️  OVERDUE by ${minutesOverdue} minute(s)!`)
    } else {
      const minutesUntil = Math.floor((nextExec.getTime() - now.getTime()) / 60000)
      console.log(`⏰ Will execute in ${minutesUntil} minute(s)`)
    }
  }
  
  console.log('')
  console.log(`Webhook URL: ${data.webhook_url}`)
}

checkStatus()