# Management Scripts

Utility scripts for testing and managing Discord Lab schedules.

## Available Scripts

### 📊 Check Schedule Status
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/check-schedule-status.ts [schedule-id]
```
Shows detailed status of a specific schedule including execution count, next execution time, and whether it's due.

### 📋 Check All Schedules
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/check-schedules.ts
```
Lists all schedules in the database with their status.

### 🔄 Reset Schedule Time
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/reset-schedule.ts [schedule-id]
```
Resets a schedule's `next_execution_at` to NOW, causing it to execute immediately on the next cron run.

### 🧪 Test Edge Function
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/test-edge-function.ts
```
Manually triggers the `execute-schedules` Edge Function to process due schedules immediately.

## Requirements

Add to your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get the service role key from: **Supabase Dashboard** > **Project Settings** > **API** > **service_role**

## Usage Examples

### Check if a schedule is working
```bash
# Check specific schedule
npx dotenv-cli -e .env.local -- npx tsx scripts/check-schedule-status.ts d75966da-abc7-4453-b0a6-0120b7724dff

# Check all schedules
npx dotenv-cli -e .env.local -- npx tsx scripts/check-schedules.ts
```

### Force immediate execution
```bash
# Reset schedule time to NOW
npx dotenv-cli -e .env.local -- npx tsx scripts/reset-schedule.ts 22dd2ff2-b1be-4545-94ae-ddb74553b87f

# Then manually trigger the Edge Function
npx dotenv-cli -e .env.local -- npx tsx scripts/test-edge-function.ts
```

### Debug execution issues
```bash
# Test the Edge Function
npx dotenv-cli -e .env.local -- npx tsx scripts/test-edge-function.ts

# Check schedule status
npx dotenv-cli -e .env.local -- npx tsx scripts/check-schedule-status.ts
```

## Notes

- Scripts use **service role key** to bypass RLS policies
- The `test-edge-function.ts` script manually triggers execution (useful for testing)
- The cron job runs automatically every minute - these scripts are for debugging/testing only
