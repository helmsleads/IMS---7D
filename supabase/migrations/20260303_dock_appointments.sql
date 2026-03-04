-- Dock Appointment System: appointment approval workflow on inbound_orders

-- Add appointment approval fields to inbound_orders
ALTER TABLE public.inbound_orders
  ADD COLUMN IF NOT EXISTS appointment_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS appointment_approved_by UUID REFERENCES public.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS appointment_approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS appointment_rejection_reason TEXT DEFAULT NULL;

-- Partial index for quick lookups on pending/approved/rejected appointments
CREATE INDEX IF NOT EXISTS idx_inbound_orders_appointment_status
  ON public.inbound_orders (appointment_status)
  WHERE appointment_status IS NOT NULL;

-- Seed dock capacity defaults into system_settings
INSERT INTO public.system_settings (category, setting_key, setting_value, description)
VALUES
  ('dock', 'max_appointments_per_slot', '3', 'Maximum concurrent dock appointments per time slot'),
  ('dock', 'dock_hours_am_start', '08:00', 'AM dock window start time'),
  ('dock', 'dock_hours_am_end', '12:00', 'AM dock window end time'),
  ('dock', 'dock_hours_pm_start', '12:00', 'PM dock window start time'),
  ('dock', 'dock_hours_pm_end', '17:00', 'PM dock window end time')
ON CONFLICT (category, setting_key) DO NOTHING;
