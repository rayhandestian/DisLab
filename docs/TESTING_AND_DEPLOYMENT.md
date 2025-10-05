# Testing & Deployment Guide

This guide covers testing strategies and deployment steps for the recurring schedules feature.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Manual Testing Checklist](#manual-testing-checklist)
3. [Deployment Steps](#deployment-steps)
4. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
5. [Rollback Procedure](#rollback-procedure)

---

## Testing Strategy

### Phase 1: Database Migration Testing

**Environment**: Development/Staging Supabase instance

1. **Backup Current Database**
   ```sql
   -- Create backup of schedules table
   CREATE TABLE schedules_backup AS SELECT * FROM schedules;
   ```

2. **Run Migration**
   - Execute the SQL from [`DATABASE_MIGRATION.md`](./DATABASE_MIGRATION.md)
   - Verify all columns were added successfully
   - Check that existing schedules have default values

3. **Verification Queries**
   ```sql
   -- Check table structure
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'schedules'
   ORDER BY ordinal_position;
   
   -- Verify existing schedules
   SELECT id, name, is_recurring, recurrence_pattern, next_execution_at
   FROM schedules
   LIMIT 10;
   
   -- Check indexes
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'schedules';
   ```

### Phase 2: Backend Testing (Edge Function)

**Test the Edge Function locally before deployment**

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Create Edge Function**
   ```bash
   supabase functions new execute-schedules
   ```

3. **Test Locally**
   ```bash
   supabase functions serve execute-schedules
   ```

4. **Test Execution**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/execute-schedules \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

### Phase 3: Frontend Testing

**Test UI components in development**

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test Schedule Creation Flow**
   - Login with Discord
   - Navigate to webhook builder
   - Test creating one-time schedule
   - Test creating recurring schedule
   - Verify form validation
   - Check error handling

3. **Test Schedule Management**
   - View schedule list
   - Edit existing schedule
   - Delete schedule
   - Toggle between one-time and recurring

---

## Manual Testing Checklist

### One-Time Schedules

- [ ] **Create one-time schedule**
  - Fill in schedule name
  - Set webhook URL
  - Add message content
  - Set future date/time
  - Click "Create Schedule"
  - Verify success message
  - Check schedule appears in list

- [ ] **Verify one-time execution**
  - Wait for scheduled time (or manually trigger cron)
  - Check webhook was sent to Discord
  - Verify schedule is marked as inactive (`is_active = false`)
  - Confirm `execution_count = 1`
  - Check `last_executed_at` is populated

- [ ] **Edit one-time schedule**
  - Click "Edit" on existing schedule
  - Modify schedule time
  - Update message
  - Save changes
  - Verify updates are reflected

- [ ] **Delete one-time schedule**
  - Click "Delete" on schedule
  - Confirm deletion
  - Verify schedule is removed from list
  - Check database record is deleted

### Daily Recurring Schedules

- [ ] **Create daily schedule**
  - Select "Recurring" option
  - Choose "Daily" pattern
  - Set time (e.g., "14:30")
  - Create schedule
  - Verify `is_recurring = true`
  - Check `recurrence_pattern = 'daily'`

- [ ] **Test natural language input**
  - Enter "daily at 2:30 PM"
  - Verify it parses correctly
  - Check preview shows "Every day at 14:30"

- [ ] **Verify daily execution**
  - Wait for first execution
  - Check webhook was sent
  - Verify `execution_count` incremented
  - Confirm `next_execution_at` is +1 day
  - Check schedule remains active

- [ ] **Test max executions limit**
  - Create daily schedule with max 3 executions
  - Wait for 3 executions
  - Verify schedule becomes inactive after 3rd execution

### Weekly Recurring Schedules

- [ ] **Create weekly schedule**
  - Select "Weekly" pattern
  - Choose days (e.g., Mon, Wed, Fri)
  - Set time
  - Create schedule

- [ ] **Test natural language**
  - Enter "every Monday at 9 AM"
  - Verify parsing
  - Enter "every weekday at 8:30 AM"
  - Check it selects Mon-Fri

- [ ] **Verify weekly execution**
  - Wait for execution on selected day
  - Check webhook sent
  - Verify `next_execution_at` is next selected day
  - Confirm skips non-selected days

### Monthly Recurring Schedules

- [ ] **Create monthly schedule**
  - Select "Monthly" pattern
  - Choose day of month (e.g., 15th)
  - Set time
  - Create schedule

- [ ] **Test natural language**
  - Enter "monthly on the 1st at noon"
  - Verify parsing

- [ ] **Verify monthly execution**
  - Wait for execution on selected day
  - Check webhook sent
  - Verify `next_execution_at` is same day next month

### Custom Cron Schedules

- [ ] **Create custom schedule**
  - Select "Custom" pattern
  - Enter cron expression (e.g., "0 9 * * 1-5")
  - Verify validation
  - Create schedule

- [ ] **Test invalid cron**
  - Enter invalid expression
  - Verify error message
  - Prevent schedule creation

- [ ] **Verify custom execution**
  - Wait for execution based on cron
  - Check webhook sent
  - Verify next execution calculated correctly

### File Attachments

- [ ] **Schedule with files**
  - Create schedule
  - Add file attachments
  - Save schedule
  - Verify files uploaded to storage
  - Check `files` JSONB contains metadata

- [ ] **Edit schedule files**
  - Edit existing schedule
  - Remove some files
  - Add new files
  - Save changes
  - Verify old files deleted from storage
  - Check new files uploaded

### Error Handling

- [ ] **Invalid webhook URL**
  - Enter invalid URL
  - Attempt to create schedule
  - Verify error message

- [ ] **Past schedule time**
  - Set schedule time in the past
  - Attempt to create
  - Verify error message

- [ ] **Missing required fields**
  - Leave name empty
  - Attempt to create
  - Verify validation error

- [ ] **Network errors**
  - Disconnect internet
  - Attempt to create schedule
  - Verify error handling

### Edge Cases

- [ ] **Timezone handling**
  - Create schedule in different timezone
  - Verify execution happens at correct local time

- [ ] **Daylight saving time**
  - Create schedule that spans DST change
  - Verify execution time adjusts correctly

- [ ] **Leap year**
  - Create monthly schedule for Feb 29
  - Verify handling in non-leap years

- [ ] **End of month**
  - Create monthly schedule for day 31
  - Verify handling in months with fewer days

---

## Deployment Steps

### Step 1: Database Migration

1. **Backup Production Database**
   ```sql
   -- In Supabase SQL Editor
   CREATE TABLE schedules_backup_YYYYMMDD AS SELECT * FROM schedules;
   ```

2. **Run Migration**
   - Copy SQL from [`DATABASE_MIGRATION.md`](./DATABASE_MIGRATION.md)
   - Execute in Supabase SQL Editor
   - Verify success messages

3. **Verify Migration**
   ```sql
   -- Check all columns exist
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'schedules';
   
   -- Check existing schedules migrated correctly
   SELECT COUNT(*) FROM schedules WHERE recurrence_pattern = 'once';
   ```

### Step 2: Deploy Edge Function

1. **Login to Supabase CLI**
   ```bash
   supabase login
   ```

2. **Link to Project**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Deploy Function**
   ```bash
   supabase functions deploy execute-schedules
   ```

4. **Set Environment Variables** (if needed)
   - Go to Supabase Dashboard > Edge Functions
   - Add any required environment variables

5. **Test Function**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/execute-schedules \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

### Step 3: Configure Cron Job

1. **Go to Supabase Dashboard**
   - Navigate to Database > Cron Jobs

2. **Create New Cron Job**
   - Name: `execute-scheduled-webhooks`
   - Schedule: `* * * * *` (every minute)
   - Command Type: HTTP Request
   - Method: POST
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/execute-schedules`
   - Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

3. **Enable Cron Job**
   - Toggle to enable
   - Monitor first few executions

### Step 4: Deploy Frontend

1. **Update Environment Variables**
   ```bash
   # In Vercel or your hosting platform
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   NEXT_PUBLIC_SITE_URL=your_domain
   ```

2. **Build and Deploy**
   ```bash
   npm run build
   # Deploy to Vercel/Netlify/etc
   ```

3. **Verify Deployment**
   - Visit production site
   - Test schedule creation
   - Check browser console for errors

### Step 5: Post-Deployment Verification

1. **Create Test Schedule**
   - Create a one-time schedule 5 minutes in future
   - Wait for execution
   - Verify webhook sent

2. **Create Recurring Test**
   - Create daily schedule
   - Wait for first execution
   - Verify `next_execution_at` updated

3. **Monitor Logs**
   - Check Edge Function logs
   - Monitor database for errors
   - Watch for failed executions

---

## Monitoring & Troubleshooting

### Monitoring Dashboard

**Key Metrics to Track:**

1. **Schedule Execution Rate**
   ```sql
   SELECT 
     DATE_TRUNC('hour', last_executed_at) as hour,
     COUNT(*) as executions
   FROM schedules
   WHERE last_executed_at > NOW() - INTERVAL '24 hours'
   GROUP BY hour
   ORDER BY hour DESC;
   ```

2. **Active Schedules**
   ```sql
   SELECT 
     recurrence_pattern,
     COUNT(*) as count
   FROM schedules
   WHERE is_active = true
   GROUP BY recurrence_pattern;
   ```

3. **Failed Executions**
   - Monitor Edge Function logs for errors
   - Check for schedules with old `next_execution_at`

4. **Execution Count Distribution**
   ```sql
   SELECT 
     execution_count,
     COUNT(*) as schedules
   FROM schedules
   WHERE is_recurring = true
   GROUP BY execution_count
   ORDER BY execution_count;
   ```

### Common Issues & Solutions

#### Issue: Schedules Not Executing

**Symptoms:**
- `next_execution_at` is in the past
- `last_executed_at` not updating
- No webhooks being sent

**Diagnosis:**
```sql
-- Check for overdue schedules
SELECT id, name, next_execution_at
FROM schedules
WHERE is_active = true
  AND next_execution_at < NOW()
ORDER BY next_execution_at
LIMIT 10;
```

**Solutions:**
1. Check cron job is enabled and running
2. Verify Edge Function is deployed
3. Check Edge Function logs for errors
4. Verify service role key is correct
5. Check rate limits on Discord webhooks

#### Issue: Incorrect Next Execution Time

**Symptoms:**
- `next_execution_at` not calculating correctly
- Schedules executing at wrong time

**Diagnosis:**
```sql
-- Check recurrence configuration
SELECT 
  id, name, recurrence_pattern, 
  recurrence_config, next_execution_at
FROM schedules
WHERE is_recurring = true
LIMIT 10;
```

**Solutions:**
1. Verify recurrence_config is valid JSON
2. Check timezone settings
3. Review Edge Function calculation logic
4. Test with simple daily schedule first

#### Issue: Files Not Attaching

**Symptoms:**
- Webhooks send but files missing
- Storage errors in logs

**Diagnosis:**
```sql
-- Check file metadata
SELECT id, name, files
FROM schedules
WHERE files IS NOT NULL
LIMIT 5;
```

**Solutions:**
1. Verify storage bucket exists
2. Check RLS policies on storage
3. Verify file paths in metadata
4. Check file size limits

#### Issue: High Execution Count

**Symptoms:**
- Schedules executing too frequently
- Duplicate executions

**Diagnosis:**
```sql
-- Check for rapid executions
SELECT 
  id, name, execution_count,
  last_executed_at, next_execution_at
FROM schedules
WHERE execution_count > 100
ORDER BY execution_count DESC;
```

**Solutions:**
1. Check cron job frequency (should be 1 minute)
2. Verify Edge Function isn't being called multiple times
3. Add execution locking mechanism
4. Check for duplicate cron jobs

---

## Rollback Procedure

### Emergency Rollback

If critical issues arise, follow this procedure:

1. **Disable Cron Job**
   - Go to Supabase Dashboard > Cron Jobs
   - Disable `execute-scheduled-webhooks`
   - This stops all automatic executions

2. **Revert Frontend** (if needed)
   - Rollback to previous deployment in Vercel/Netlify
   - Or deploy previous git commit

3. **Restore Database** (if needed)
   ```sql
   -- Only if data corruption occurred
   DROP TABLE schedules;
   CREATE TABLE schedules AS SELECT * FROM schedules_backup_YYYYMMDD;
   ```

4. **Remove Edge Function** (if needed)
   ```bash
   supabase functions delete execute-schedules
   ```

### Partial Rollback

If only specific features are problematic:

1. **Disable Recurring Schedules**
   ```sql
   -- Temporarily disable all recurring schedules
   UPDATE schedules
   SET is_active = false
   WHERE is_recurring = true;
   ```

2. **Keep One-Time Schedules Working**
   - One-time schedules can continue
   - Fix recurring logic separately

3. **Re-enable After Fix**
   ```sql
   UPDATE schedules
   SET is_active = true
   WHERE is_recurring = true
     AND (max_executions IS NULL OR execution_count < max_executions);
   ```

---

## Performance Optimization

### Database Optimization

1. **Index Optimization**
   ```sql
   -- Analyze query performance
   EXPLAIN ANALYZE
   SELECT * FROM schedules
   WHERE is_active = true
     AND next_execution_at <= NOW()
   ORDER BY next_execution_at
   LIMIT 100;
   ```

2. **Vacuum and Analyze**
   ```sql
   VACUUM ANALYZE schedules;
   ```

### Edge Function Optimization

1. **Batch Processing**
   - Process schedules in batches of 100
   - Prevents timeout on large datasets

2. **Parallel Execution**
   - Consider parallel webhook sending
   - Use Promise.all() for concurrent requests

3. **Error Handling**
   - Don't let one failed schedule block others
   - Implement retry logic with exponential backoff

### Monitoring Queries

```sql
-- Slow queries
SELECT * FROM pg_stat_statements
WHERE query LIKE '%schedules%'
ORDER BY total_time DESC
LIMIT 10;

-- Table size
SELECT pg_size_pretty(pg_total_relation_size('schedules'));

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'schedules';
```

---

## Success Criteria

The deployment is considered successful when:

- [ ] All database migrations completed without errors
- [ ] Edge Function deployed and responding
- [ ] Cron job running every minute
- [ ] One-time schedules executing correctly
- [ ] Recurring schedules executing and updating `next_execution_at`
- [ ] No errors in Edge Function logs
- [ ] Frontend UI working for all schedule types
- [ ] File attachments uploading and sending correctly
- [ ] Natural language parsing working
- [ ] Schedule editing and deletion working
- [ ] RLS policies preventing unauthorized access
- [ ] Performance metrics within acceptable ranges
