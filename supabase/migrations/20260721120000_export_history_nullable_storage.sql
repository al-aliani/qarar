-- Make storage_path nullable to support PDF tracking via window.print()
ALTER TABLE public.export_history ALTER COLUMN storage_path DROP NOT NULL;
