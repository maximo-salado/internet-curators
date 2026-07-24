-- 018_user_article_actions.sql
-- Per-user vote/save/dismiss tracking for discovery pivot
-- Layers on top of existing article_votes aggregate table

create table if not exists user_article_actions (
  user_id    uuid    not null references auth.users on delete cascade,
  article_id uuid    not null references articles(id) on delete cascade,
  action     text    not null check (action in ('upvote', 'downvote', 'save', 'dismiss')),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id, action)
);

-- Only the owning user can read/write their own actions
alter table user_article_actions enable row level security;

create policy "users manage own actions"
  on user_article_actions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fetching all actions for a user across a batch of articles
create index user_article_actions_user_articles
  on user_article_actions (user_id, article_id);
