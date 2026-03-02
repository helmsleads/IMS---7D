-- FedEx Alcohol Shipping Integration
-- Add shipping method tracking to outbound orders

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS fedex_shipment_id TEXT,
  ADD COLUMN IF NOT EXISTS label_url TEXT,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'manual';

-- Index for looking up orders by FedEx shipment ID
CREATE INDEX IF NOT EXISTS idx_outbound_orders_fedex_shipment_id
  ON outbound_orders (fedex_shipment_id)
  WHERE fedex_shipment_id IS NOT NULL;

-- Create private storage bucket for shipping labels
INSERT INTO storage.buckets (id, name, public)
VALUES ('shipping-labels', 'shipping-labels', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: authenticated users can read/write shipping labels
CREATE POLICY "Authenticated users can upload shipping labels"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shipping-labels');

CREATE POLICY "Authenticated users can read shipping labels"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'shipping-labels');
