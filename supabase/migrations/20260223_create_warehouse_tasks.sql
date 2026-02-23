-- ============================================================
-- Warehouse Tasks: Central task queue for inspection, putaway, pick
-- ============================================================

-- warehouse_tasks table
CREATE TABLE public.warehouse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number TEXT UNIQUE NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('inspection', 'putaway', 'pick')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

  client_id UUID REFERENCES public.clients(id),
  product_id UUID REFERENCES public.products(id),
  lpn_id UUID REFERENCES public.lpns(id),
  lot_id UUID REFERENCES public.lots(id),

  order_id UUID,
  order_type TEXT CHECK (order_type IN ('inbound', 'outbound')),

  source_location_id UUID REFERENCES public.locations(id),
  source_sublocation_id UUID REFERENCES public.sublocations(id),
  destination_location_id UUID REFERENCES public.locations(id),
  destination_sublocation_id UUID REFERENCES public.sublocations(id),

  qty_requested NUMERIC DEFAULT 0,
  qty_completed NUMERIC DEFAULT 0,

  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_by TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  completed_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_warehouse_tasks_type_status ON public.warehouse_tasks(task_type, status);
CREATE INDEX idx_warehouse_tasks_assigned_to ON public.warehouse_tasks(assigned_to);
CREATE INDEX idx_warehouse_tasks_order ON public.warehouse_tasks(order_id, order_type);
CREATE INDEX idx_warehouse_tasks_priority ON public.warehouse_tasks(priority DESC, created_at ASC);

-- Updated_at trigger
CREATE TRIGGER set_warehouse_tasks_updated_at
  BEFORE UPDATE ON public.warehouse_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.warehouse_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view warehouse tasks"
  ON public.warehouse_tasks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert warehouse tasks"
  ON public.warehouse_tasks FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update warehouse tasks"
  ON public.warehouse_tasks FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- Inspection Results
-- ============================================================

CREATE TABLE public.inspection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.warehouse_tasks(id) ON DELETE CASCADE,
  results JSONB NOT NULL DEFAULT '[]',
  overall_result TEXT NOT NULL CHECK (overall_result IN ('pass', 'fail', 'partial')),
  inspector_notes TEXT,
  inspected_by UUID REFERENCES auth.users(id),
  inspected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inspection_results_task ON public.inspection_results(task_id);

ALTER TABLE public.inspection_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inspection results"
  ON public.inspection_results FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert inspection results"
  ON public.inspection_results FOR INSERT
  TO authenticated WITH CHECK (true);


-- ============================================================
-- Pick List Items
-- ============================================================

CREATE TABLE public.pick_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.warehouse_tasks(id) ON DELETE CASCADE,
  outbound_item_id UUID REFERENCES public.outbound_items(id),
  product_id UUID REFERENCES public.products(id),
  lot_id UUID REFERENCES public.lots(id),
  location_id UUID REFERENCES public.locations(id),
  sublocation_id UUID REFERENCES public.sublocations(id),
  qty_allocated NUMERIC NOT NULL DEFAULT 0,
  qty_picked NUMERIC NOT NULL DEFAULT 0,
  qty_short NUMERIC NOT NULL DEFAULT 0,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'picked', 'short', 'skipped')),
  picked_by UUID REFERENCES auth.users(id),
  picked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pick_list_items_task ON public.pick_list_items(task_id);
CREATE INDEX idx_pick_list_items_outbound_item ON public.pick_list_items(outbound_item_id);
CREATE INDEX idx_pick_list_items_status ON public.pick_list_items(status);

CREATE TRIGGER set_pick_list_items_updated_at
  BEFORE UPDATE ON public.pick_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pick_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pick list items"
  ON public.pick_list_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert pick list items"
  ON public.pick_list_items FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update pick list items"
  ON public.pick_list_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- generate_task_number RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_task_number(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date TEXT;
  v_seq INTEGER;
  v_task_number TEXT;
BEGIN
  v_date := to_char(CURRENT_DATE, 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(task_number FROM LENGTH(p_prefix) + 10 FOR 4) AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM public.warehouse_tasks
  WHERE task_number LIKE p_prefix || '-' || v_date || '-%';

  v_task_number := p_prefix || '-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');

  RETURN v_task_number;
END;
$$;


-- ============================================================
-- Add inspection_criteria to workflow_profiles
-- ============================================================

ALTER TABLE public.workflow_profiles
  ADD COLUMN IF NOT EXISTS inspection_criteria JSONB DEFAULT '[]';
