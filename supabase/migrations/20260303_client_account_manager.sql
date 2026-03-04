-- Add account manager assignment to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES public.users(id);
CREATE INDEX IF NOT EXISTS idx_clients_account_manager ON clients(account_manager_id);
