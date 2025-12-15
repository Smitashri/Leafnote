-- Create leafnote_events table for tracking user engagement
CREATE TABLE IF NOT EXISTS leafnote_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    anon_id text NOT NULL,
    user_id uuid,
    event_name text NOT NULL,
    book_title text,
    book_author text,
    book_rating int,
    book_status text,
    metadata jsonb
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_leafnote_events_created_at ON leafnote_events(created_at);
CREATE INDEX IF NOT EXISTS idx_leafnote_events_event_name ON leafnote_events(event_name);
CREATE INDEX IF NOT EXISTS idx_leafnote_events_user_id ON leafnote_events(user_id);
CREATE INDEX IF NOT EXISTS idx_leafnote_events_anon_id ON leafnote_events(anon_id);

-- Enable Row Level Security
ALTER TABLE leafnote_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public insert (anon key can insert events)
CREATE POLICY "Allow public insert" ON leafnote_events
    FOR INSERT
    WITH CHECK (true);

-- Policy: Restrict select/update/delete to service role only
-- (No policies for SELECT/UPDATE/DELETE means only service role can access)
-- This ensures analytics data is only readable server-side

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON leafnote_events TO anon, authenticated;
