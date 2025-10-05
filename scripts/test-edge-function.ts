/**
 * Test script to manually trigger the execute-schedules Edge Function
 * Usage: npx tsx scripts/test-edge-function.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execute-schedules`

async function testEdgeFunction() {
  console.log('🚀 Testing Edge Function...')
  console.log(`📍 URL: ${EDGE_FUNCTION_URL}`)
  console.log('')

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    })

    console.log(`📊 Status: ${response.status} ${response.statusText}`)
    
    const data = await response.json()
    console.log('📦 Response:')
    console.log(JSON.stringify(data, null, 2))

    if (data.processed > 0) {
      console.log('')
      console.log(`✅ Processed ${data.processed} schedule(s)`)
      data.results?.forEach((result: any, idx: number) => {
        console.log(`\n  Schedule ${idx + 1}:`)
        console.log(`    ID: ${result.id}`)
        console.log(`    Name: ${result.name}`)
        console.log(`    Success: ${result.success ? '✅' : '❌'}`)
        console.log(`    Status: ${result.status}`)
        console.log(`    Continues: ${result.continues ? 'Yes' : 'No'}`)
        if (result.nextExecution) {
          console.log(`    Next: ${result.nextExecution}`)
        }
      })
    } else {
      console.log('')
      console.log('ℹ️  No schedules were due for execution')
    }

  } catch (error) {
    console.error('❌ Error calling Edge Function:')
    console.error(error)
    process.exit(1)
  }
}

testEdgeFunction()