Step-by-step: create `books` table & RLS in Supabase

1) Open your Supabase project:
   https://app.supabase.com/project/ipeihablpncfzgkwvdhi

2) Go to `SQL Editor` → `New query`.

3) Copy the SQL from `supabase/init_books_table.sql` (this file) and run it.
   - This creates the `books` table and enables Row Level Security (RLS).

4) Verify: In Supabase Dashboard → Database → Table Editor → `books` you should see the table.

5) How to test from your app:
   - Ensure `.env.local` in project root contains the keys (already added).
   - Restart dev server: `npm start`.
   - In the app, use the header sign-in to request a magic link for your email.
   - Click the magic link to sign in, then add a book. The app will upsert rows into `books` for your user.

6) If you prefer a safer migration flow using supabase CLI or CI, I can generate a migration file you can apply.

Notes & troubleshooting
- Creating the `pgcrypto` extension and tables requires owner privileges; run the SQL from the Supabase SQL Editor while logged into the project dashboard (you are the project owner).
- The `anon` key cannot create tables via the public client. That's why you must run the SQL in the dashboard (or use the `service_role` key via server-side scripts — do NOT expose `service_role` in the browser).
