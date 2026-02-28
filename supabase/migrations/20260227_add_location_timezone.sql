-- Add timezone column to locations table
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- Comment for clarity
COMMENT ON COLUMN locations.timezone IS 'IANA timezone identifier (e.g. America/New_York, America/Chicago)';
