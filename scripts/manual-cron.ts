/**
 * Manual cron - runs the Edge Function every minute
 * Usage: npx tsx scripts/manual-cron.ts
 * Press Ctrl+C to stop
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!')
  process.exit(1)
}

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execute-schedules`

let runCount = 0

async function executeSchedules() {
  runCount++
  const now = new Date()
  console.log(`\n[${now.toLocaleTimeString()}] Run #${runCount} - Calling Edge Function...`)
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    
    if (data.processed > 0) {
      console.log(`✅ Processed ${data.processed} schedule(s)`)
      data.results?.forEach((result: any) => {
        console.log(`   - ${result.name}: ${result.success ? '✅ Success' : '❌ Failed'}`)
        if (result.continues) {
          console.log(`     Next: ${new Date(result.nextExecution).toLocaleTimeString()}`)
        } else {
          console.log(`     Status: Completed`)
        }
      })
    } else {
      console.log('ℹ️  No schedules due')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

console.log('🔄 Manual Cron Started')
console.log('Running every 60 seconds...')
console.log('Press Ctrl+C to stop\n')

// Run immediately
executeSchedules()

// Then run every 60 seconds
setInterval(executeSchedules, 60000)