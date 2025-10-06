-- ============================================
-- Discord Lab - Add Recurrence Fields Migration
-- ============================================

-- Add recurrence-related columns to schedules table
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT,
  ADD COLUMN IF NOT EXISTS cron_expression TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
  ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_executions INTEGER;

-- Create index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_schedules_next_execution
  ON public.schedules(next_execution_at)
  WHERE is_active = true;

-- Update existing schedules to have next_execution_at set
UPDATE public.schedules
SET next_execution_at = schedule_time
WHERE next_execution_at IS NULL AND is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN public.schedules.is_recurring IS 'Whether this schedule repeats';
COMMENT ON COLUMN public.schedules.recurrence_pattern IS 'Pattern type: once, cron';
COMMENT ON COLUMN public.schedules.cron_expression IS 'Cron expression for recurring schedules';
COMMENT ON COLUMN public.schedules.recurrence_config IS 'Additional recurrence configuration including timezone';
COMMENT ON COLUMN public.schedules.next_execution_at IS 'Next scheduled execution time';
COMMENT ON COLUMN public.schedules.execution_count IS 'Number of times this schedule has executed';
COMMENT ON COLUMN public.schedules.max_executions IS 'Maximum number of executions (NULL for unlimited)';