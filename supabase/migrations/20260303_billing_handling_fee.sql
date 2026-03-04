-- Add handling fee to workflow profiles for per-order billing
ALTER TABLE workflow_profiles
  ADD COLUMN IF NOT EXISTS billing_handling_fee NUMERIC(10,2) DEFAULT 0;
