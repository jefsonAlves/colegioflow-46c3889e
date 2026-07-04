
CREATE POLICY "class-content teacher rw" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'class-content' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'class-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "class-content admin read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'class-content'
  AND EXISTS (
    SELECT 1 FROM public.school_memberships m
    WHERE m.user_id = auth.uid()
      AND m.role_in_school = 'school_admin'
      AND m.status = 'approved'
  )
);
