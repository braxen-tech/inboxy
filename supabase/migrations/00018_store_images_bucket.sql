-- Create Supabase Storage bucket for store images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own org folder
CREATE POLICY "store_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations WHERE owner_user_id = auth.uid()
    )
  );

-- RLS: authenticated users can delete their own images
CREATE POLICY "store_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations WHERE owner_user_id = auth.uid()
    )
  );

-- Public read (bucket is public, but explicit policy for clarity)
CREATE POLICY "store_images_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'store-images');
