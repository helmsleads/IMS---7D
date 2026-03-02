-- Convert workflow_profiles.industry (TEXT) to industries (TEXT[])
ALTER TABLE workflow_profiles
  ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}';

-- Migrate existing data: copy single industry into the array
UPDATE workflow_profiles
  SET industries = ARRAY[industry]
  WHERE industry IS NOT NULL AND (industries IS NULL OR industries = '{}');

-- Drop the old column
ALTER TABLE workflow_profiles DROP COLUMN IF EXISTS industry;
