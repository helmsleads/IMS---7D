-- Staff rows in public.users use id = auth.users(id). Populate auth_id for tooling/RLS that expect it.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id);

UPDATE public.users
SET auth_id = id
WHERE auth_id IS NULL
  AND id IS NOT NULL;
