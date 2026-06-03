-- Conversation participants: account manager + looped-in warehouse managers
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_role TEXT NOT NULL CHECK (
    participant_role IN ('account_manager', 'warehouse_manager')
  ),
  added_by UUID REFERENCES public.users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation
  ON public.conversation_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
  ON public.conversation_participants(user_id);

COMMENT ON TABLE public.conversation_participants IS
  'Internal staff assigned to a client messaging thread';
