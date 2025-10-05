-- ============================================
-- Discord Lab - Saved Webhooks Migration
-- ============================================

-- Step 1: Create saved_webhooks table
CREATE TABLE public.saved_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_data JSONB,
  builder_state JSONB,
  files JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add saved_webhook_id to schedules table
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS saved_webhook_id UUID REFERENCES public.saved_webhooks(id) ON DELETE CASCADE;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_webhooks_user_id ON public.saved_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_saved_webhook_id ON public.schedules(saved_webhook_id);

-- Step 4: Enable RLS on saved_webhooks
ALTER TABLE public.saved_webhooks ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for saved_webhooks
CREATE POLICY "Users can view own saved webhooks"
  ON public.saved_webhooks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved webhooks"
  ON public.saved_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved webhooks"
  ON public.saved_webhooks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved webhooks"
  ON public.saved_webhooks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 6: Create function to update updated_at on saved_webhooks
CREATE OR REPLACE FUNCTION public.update_saved_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saved_webhooks_updated_at ON public.saved_webhooks;
CREATE TRIGGER saved_webhooks_updated_at
  BEFORE UPDATE ON public.saved_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_saved_webhooks_updated_at();

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_webhooks TO authenticated;

-- Step 8: Add comment for documentation
COMMENT ON TABLE public.saved_webhooks IS 'Stores reusable webhook configurations for scheduling';
COMMENT ON COLUMN public.saved_webhooks.message_data IS 'Serialized webhook message payload';
COMMENT ON COLUMN public.saved_webhooks.builder_state IS 'UI builder state for webhook configuration';
COMMENT ON COLUMN public.saved_webhooks.files IS 'Attached files metadata';
COMMENT ON COLUMN public.schedules.saved_webhook_id IS 'Reference to the saved webhook configuration used by this schedule';