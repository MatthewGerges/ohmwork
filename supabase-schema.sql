-- Run this entire file in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- 1. Questions table
create table if not exists questions (
  id                      bigint generated always as identity primary key,
  created_at              timestamptz default now() not null,
  category                text not null,
  difficulty              text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_text           text not null,
  answer_text             text not null,
  explanation_text        text,
  main_video_youtube_id   text,
  resource_videos         jsonb not null default '[]'::jsonb,
  ltspice_file_url        text,
  related_question_ids    bigint[] not null default '{}',
  tags                    text[] not null default '{}',
  bonus_question_text     text,
  bonus_answer_text       text
);

-- 2. Row Level Security: public reads, service role writes
alter table questions enable row level security;

drop policy if exists "public_read" on questions;
drop policy if exists "authenticated_read" on questions;
revoke select on questions from anon;
grant select on questions to authenticated;

create policy "authenticated_read" on questions
  for select to authenticated using (true);

-- Service role bypasses RLS automatically, so no additional policy needed for writes.

-- If you already ran the schema before, add optional columns with:
-- alter table questions add column if not exists explanation_text text;
-- alter table questions add column if not exists bonus_question_text text;
-- alter table questions add column if not exists bonus_answer_text text;

-- 3. Storage bucket for LTspice files
insert into storage.buckets (id, name, public)
values ('ltspice-files', 'ltspice-files', true)
on conflict (id) do nothing;

-- Allow public downloads
create policy "public_download_ltspice" on storage.objects
  for select using (bucket_id = 'ltspice-files');

-- 4. Storage bucket for question images (pasted inline into questions)
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

create policy "public_download_question_images" on storage.objects
  for select using (bucket_id = 'question-images');

-- 5. Signed-in user progress
create table if not exists user_question_progress (
  user_id           uuid not null references auth.users(id) on delete cascade,
  question_id       bigint not null references questions(id) on delete cascade,
  next_review_date  timestamptz not null,
  interval_days     integer not null check (interval_days >= 1),
  review_count      integer not null default 1 check (review_count >= 1),
  last_reviewed_at  timestamptz,
  last_rating       text check (last_rating in ('easy', 'medium', 'hard')),
  updated_at        timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists user_question_progress_question_idx
  on user_question_progress (question_id);

alter table user_question_progress enable row level security;
grant select, insert, update, delete on user_question_progress to authenticated;

create policy "users_read_own_progress" on user_question_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_progress" on user_question_progress
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users_update_own_progress" on user_question_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_delete_own_progress" on user_question_progress
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 6. Signed-in user's saved question deck
create table if not exists user_question_queue (
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  bigint not null references questions(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists user_question_queue_user_created_idx
  on user_question_queue (user_id, created_at);
create index if not exists user_question_queue_question_idx
  on user_question_queue (question_id);

alter table user_question_queue enable row level security;
grant select, insert, delete on user_question_queue to authenticated;

create policy "users_read_own_queue" on user_question_queue
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_queue" on user_question_queue
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users_delete_own_queue" on user_question_queue
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 7. Community interview-question submissions
create table if not exists question_submissions (
  id                    bigint generated always as identity primary key,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  submitter_email       text,
  status                text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  category              text not null check (char_length(category) between 1 and 160),
  difficulty            text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_text         text not null check (char_length(question_text) between 1 and 4000),
  answer_text           text not null check (char_length(answer_text) between 1 and 12000),
  explanation_text      text check (char_length(explanation_text) <= 16000),
  bonus_question_text   text check (char_length(bonus_question_text) <= 4000),
  bonus_answer_text     text check (char_length(bonus_answer_text) <= 12000),
  interview_context     text check (char_length(interview_context) <= 2000),
  admin_notes           text check (char_length(admin_notes) <= 4000),
  reviewed_at           timestamptz,
  approved_question_id  bigint references questions(id) on delete set null
);

create index if not exists question_submissions_status_created_idx
  on question_submissions (status, created_at desc);
create index if not exists question_submissions_user_created_idx
  on question_submissions (user_id, created_at desc);
create index if not exists question_submissions_approved_question_idx
  on question_submissions (approved_question_id);

alter table question_submissions enable row level security;
grant select, insert on question_submissions to authenticated;
grant usage, select on sequence question_submissions_id_seq to authenticated;

create policy "users_read_own_submissions" on question_submissions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_create_own_submissions" on question_submissions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and submitter_email = ((select auth.jwt()) ->> 'email')
  );

-- Event-trigger functions do not need to be callable through the Data API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
