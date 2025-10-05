-- ============================================
-- Discord Lab - Webhook Files Storage Policies
-- ============================================

-- Enable RLS on the webhook-files bucket
-- Note: This is done automatically when creating the bucket via dashboard,
-- but we can ensure policies are set via SQL

-- Policy: Allow authenticated users to upload files to their own user directory
CREATE POLICY "Users can upload webhook files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'webhook-files'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Policy: Allow authenticated users to view their own webhook files
CREATE POLICY "Users can view own webhook files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'webhook-files'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Policy: Allow authenticated users to update their own webhook files
CREATE POLICY "Users can update own webhook files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'webhook-files'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  )
  WITH CHECK (
    bucket_id = 'webhook-files'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Policy: Allow authenticated users to delete their own webhook files
CREATE POLICY "Users can delete own webhook files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'webhook-files'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;