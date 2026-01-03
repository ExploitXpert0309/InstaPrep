-- Enable deletion of test attempts
CREATE POLICY "Users can delete their own attempts"
ON public.test_attempts FOR DELETE
USING (auth.uid() = user_id);
