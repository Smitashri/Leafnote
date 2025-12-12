-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- Creates `books` table and enables Row Level Security so each user can access only their rows.

create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  title text not null,
  rating int,
  status text not null, -- 'read' or 'to_read'
  date_read timestamptz,
  date_added timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.books enable row level security;

create policy "Users can manage their own books"
  on public.books
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: Index to speed up queries per user
create index if not exists idx_books_user_created on public.books (user_id, created_at desc);
