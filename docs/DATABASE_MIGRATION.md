# Database Migration for Recurring Schedules

## Overview

This migration adds support for recurring schedules to the existing `schedules` table. It's designed to be backward-compatible with existing one-time schedules.

## Migration SQL

Run this SQL in your Supabase SQL Editor:

```sql
-- ============================================
-- Discord Lab - Recurring Schedules Migration
-- ============================================

-- Step 1: Add new columns to schedules table
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS builder_state JSONB,
  ADD COLUMN IF NOT EXISTS files JSONB,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (
    recurrence_pattern IN ('once', 'daily', 'weekly', 'monthly', 'custom')
  ),
  ADD COLUMN IF NOT EXISTS cron_expression TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_executions INTEGER;

-- Step 2: Set default recurrence pattern for existing schedules
UPDATE public.schedules
SET 
  recurrence_pattern = 'once',
  is_recurring = false,
  next_execution_at = schedule_time
WHERE recurrence_pattern IS NULL;

-- Step 3: Create index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_schedules_next_execution 
  ON public.schedules(next_execution_at) 
  WHERE is_active = true;

-- Step 4: Create index for user queries
CREATE INDEX IF NOT EXISTS idx_schedules_user_active
  ON public.schedules(user_id, is_active);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN public.schedules.recurrence_pattern IS 
  'Type of recurrence: once, daily, weekly, monthly, or custom';

COMMENT ON COLUMN public.schedules.recurrence_config IS 
  'JSON configuration for recurrence pattern. Format depends on pattern type:
   - daily: { "time": "HH:mm" }
   - weekly: { "days": [0-6], "time": "HH:mm" }
   - monthly: { "day": 1-31, "time": "HH:mm" }
   - custom: { "cronExpression": "* * * * *" }';

COMMENT ON COLUMN public.schedules.next_execution_at IS 
  'Next scheduled execution time. Updated after each execution for recurring schedules.';

COMMENT ON COLUMN public.schedules.max_executions IS 
  'Maximum number of times to execute. NULL means unlimited for recurring schedules.';

-- Step 6: Create function to update next_execution_at
CREATE OR REPLACE FUNCTION public.calculate_next_execution(
  p_schedule_id UUID
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_schedule RECORD;
  v_next_time TIMESTAMP WITH TIME ZONE;
  v_current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Get schedule details
  SELECT * INTO v_schedule
  FROM public.schedules
  WHERE id = p_schedule_id;

  -- If not recurring or inactive, return NULL
  IF NOT v_schedule.is_recurring OR NOT v_schedule.is_active THEN
    RETURN NULL;
  END IF;

  -- Calculate based on pattern
  CASE v_schedule.recurrence_pattern
    WHEN 'daily' THEN
      v_next_time := v_current_time + INTERVAL '1 day';
      
    WHEN 'weekly' THEN
      v_next_time := v_current_time + INTERVAL '7 days';
      
    WHEN 'monthly' THEN
      v_next_time := v_current_time + INTERVAL '1 month';
      
    ELSE
      -- For custom patterns, return current time + 1 day as fallback
      -- The Edge Function will handle proper cron parsing
      v_next_time := v_current_time + INTERVAL '1 day';
  END CASE;

  RETURN v_next_time;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedules_updated_at ON public.schedules;
CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedules_updated_at();

-- Step 8: Create view for active schedules (useful for monitoring)
CREATE OR REPLACE VIEW public.active_schedules AS
SELECT 
  s.id,
  s.user_id,
  s.name,
  s.webhook_url,
  s.schedule_time,
  s.next_execution_at,
  s.is_recurring,
  s.recurrence_pattern,
  s.execution_count,
  s.max_executions,
  s.created_at,
  p.tier as user_tier
FROM public.schedules s
JOIN public.profiles p ON s.user_id = p.id
WHERE s.is_active = true
ORDER BY s.next_execution_at ASC;

-- Grant access to authenticated users
GRANT SELECT ON public.active_schedules TO authenticated;

-- Note: Views don't support RLS policies directly.
-- Security is inherited from the underlying schedules table RLS policies.
```

## Rollback SQL (if needed)

If you need to rollback this migration:

```sql
-- WARNING: This will remove recurring schedule functionality
-- and delete the new columns. Backup your data first!

-- Revoke grants and drop view
REVOKE SELECT ON public.active_schedules FROM authenticated;
DROP VIEW IF EXISTS public.active_schedules;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS schedules_updated_at ON public.schedules;
DROP FUNCTION IF EXISTS public.update_schedules_updated_at();
DROP FUNCTION IF EXISTS public.calculate_next_execution(UUID);

-- Drop indexes
DROP INDEX IF EXISTS public.idx_schedules_next_execution;
DROP INDEX IF EXISTS public.idx_schedules_user_active;

-- Remove columns (WARNING: This deletes data!)
ALTER TABLE public.schedules
  DROP COLUMN IF EXISTS builder_state,
  DROP COLUMN IF EXISTS files,
  DROP COLUMN IF EXISTS is_recurring,
  DROP COLUMN IF EXISTS recurrence_pattern,
  DROP COLUMN IF EXISTS cron_expression,
  DROP COLUMN IF EXISTS recurrence_config,
  DROP COLUMN IF EXISTS last_executed_at,
  DROP COLUMN IF EXISTS next_execution_at,
  DROP COLUMN IF EXISTS execution_count,
  DROP COLUMN IF EXISTS max_executions;
```

## Verification Queries

After running the migration, verify it worked correctly:

```sql
-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'schedules'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'schedules'
  AND schemaname = 'public';

-- Check existing schedules were updated
SELECT 
  id,
  name,
  is_recurring,
  recurrence_pattern,
  next_execution_at,
  execution_count
FROM public.schedules
LIMIT 10;

-- Check active schedules view
SELECT * FROM public.active_schedules LIMIT 5;
```

## Post-Migration Steps

1. **Update Application Code**: Deploy the updated TypeScript types and service functions
2. **Test Schedule Creation**: Create a test schedule to verify the new fields work
3. **Deploy Edge Function**: Set up the `execute-schedules` Edge Function
4. **Configure Cron**: Set up Supabase cron job to run every minute
5. **Monitor Execution**: Watch the first few executions to ensure they work correctly

## Data Migration Notes

- **Existing Schedules**: All existing schedules will be set to `recurrence_pattern = 'once'` and `is_recurring = false`
- **Backward Compatibility**: The old `schedule_time` field is preserved and still used for one-time schedules
- **Next Execution**: The `next_execution_at` field is populated from `schedule_time` for existing schedules
- **No Data Loss**: This migration is additive only - no existing data is deleted

## Storage Bucket Setup

If not already created, you'll need to set up the storage bucket for file attachments:

```sql
-- Create storage bucket for webhook files
INSERT INTO storage.buckets (id, name, public)
VALUES ('webhook-files', 'webhook-files', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'webhook-files' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'webhook-files' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'webhook-files' AND
  (storage.foldername(name))[1] = 'users' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

## Troubleshooting

### Issue: Migration fails with "column already exists"
**Solution**: Some columns may already exist. The migration uses `IF NOT EXISTS` clauses, but if you get errors, check which columns exist and comment out those lines.

### Issue: RLS policies conflict
**Solution**: Drop existing policies first:
```sql
DROP POLICY IF EXISTS "Users can view own schedules" ON public.schedules;
-- Then recreate them
```

### Issue: Index creation fails
**Solution**: Check if indexes already exist:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'schedules';
```

## Performance Considerations

- **Index on next_execution_at**: Critical for fast cron queries
- **Partial Index**: Only indexes active schedules to reduce index size
- **View Performance**: The `active_schedules` view joins with profiles, consider materialized view for large datasets

## Security Notes

- All new columns respect existing RLS policies
- File storage uses path-based security (users/[user_id]/...)
- Edge Function uses service role key (keep secure!)
- Webhook URLs should be validated before storage