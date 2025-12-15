-- Create leafnote_events table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.leafnote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  anon_id text,
  user_id uuid,
  event_name text NOT NULL,
  book_title text,
  book_author text,
  book_rating int,
  book_status text,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_leafnote_events_created_at ON public.leafnote_events (created_at);
CREATE INDEX IF NOT EXISTS idx_leafnote_events_event_name ON public.leafnote_events (event_name);
CREATE INDEX IF NOT EXISTS idx_leafnote_events_user_id ON public.leafnote_events (user_id);
CREATE INDEX IF NOT EXISTS idx_leafnote_events_anon_id ON public.leafnote_events (anon_id);
