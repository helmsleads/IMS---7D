-- FedEx shipment audit log
-- Stores request/response payloads for debugging and support

CREATE TABLE IF NOT EXISTS public.fedex_shipment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_order_id UUID REFERENCES public.outbound_orders(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'rate', 'track', 'cancel')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fedex_shipment_log_outbound_order_id
  ON public.fedex_shipment_log (outbound_order_id);

CREATE INDEX IF NOT EXISTS idx_fedex_shipment_log_created_at
  ON public.fedex_shipment_log (created_at DESC);

