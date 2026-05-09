-- SJ Giants Tracker Schema
-- Run this in your Supabase SQL Editor

-- Games table
create table if not exists games (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  date date not null,
  location text not null default 'home', -- 'home' or 'away'
  opponent text not null,
  affiliate text,
  sj_score integer not null default 0,
  opp_score integer not null default 0,
  result text not null, -- 'W', 'L', 'T'
  notes text,
  mlb_game_pk bigint -- from MLB Stats API
);

-- Players table (master prospect/player database)
create table if not exists players (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text not null unique,
  is_prospect boolean default false,
  prospect_info text,
  org text, -- 'SF', 'ARI', 'LAD', 'COL', etc
  org_rank integer, -- top 30 rank within org
  mlb_top100 boolean default false,
  mlb_rank integer -- current MLB Pipeline rank
);

-- Game player stats (one row per player per game)
create table if not exists game_stats (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  game_id bigint references games(id) on delete cascade,
  player_id bigint references players(id) on delete cascade,
  team text not null, -- 'home' or 'away'
  position text,
  -- batting
  ab integer default 0,
  r integer default 0,
  h integer default 0,
  hr integer default 0,
  rbi integer default 0,
  bb integer default 0,
  k integer default 0,
  -- pitching
  ip text, -- e.g. '5.1'
  k_pit integer,
  er integer,
  era text,
  notes text
);

-- Prospect database (for auto-tagging)
create table if not exists prospect_db (
  id bigint generated always as identity primary key,
  updated_at timestamptz default now(),
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  org text not null,
  org_rank integer,
  mlb_top100 boolean default false,
  mlb_rank integer,
  prospect_info text,
  unique(name_lower, org)
);

-- Enable Row Level Security (open read, open write for now)
alter table games enable row level security;
alter table players enable row level security;
alter table game_stats enable row level security;
alter table prospect_db enable row level security;

create policy "Allow all" on games for all using (true) with check (true);
create policy "Allow all" on players for all using (true) with check (true);
create policy "Allow all" on game_stats for all using (true) with check (true);
create policy "Allow all" on prospect_db for all using (true) with check (true);

-- Seed prospect database with known players from your games
insert into prospect_db (name, org, org_rank, mlb_top100, mlb_rank, prospect_info) values
('Jhonny Level', 'SF', 4, true, 90, 'SF Giants #4 prospect — MLB Pipeline #90 overall'),
('Keyner Martinez', 'SF', 11, false, null, 'SF Giants #11 prospect (MLB Pipeline)'),
('Argenis Cayama', 'SF', 13, false, null, 'SF Giants #13 prospect (MLB Pipeline)'),
('Lorenzo Meola', 'SF', 19, false, null, 'SF Giants #19 prospect (MLB Pipeline)'),
('Cunningham', 'ARI', 2, true, 99, 'ARI Diamondbacks #2 prospect — MLB Pipeline #99 overall'),
('Morales E.', 'LAD', 5, true, 78, 'LA Dodgers #5 prospect — MLB Pipeline #78 overall'),
('Ko', 'LAD', 9, false, null, 'LA Dodgers #9 prospect (MLB Pipeline)'),
('Vargas J.', 'LAD', 10, false, null, 'LA Dodgers #10 prospect (MLB Pipeline)'),
('Elkins', 'LAD', 41, false, null, 'LA Dodgers #41 prospect (MLB Pipeline)'),
('Holliday', 'COL', 1, true, 16, 'COL Rockies #1 prospect — MLB Pipeline #16 overall'),
('Brito', 'COL', 4, true, 95, 'COL Rockies #4 prospect — MLB Pipeline #95 overall'),
('Bernard', 'COL', 29, false, null, 'COL Rockies #29 prospect (MLB Pipeline)'),
('Thach', 'COL', 31, false, null, 'COL Rockies #31 prospect (MLB Pipeline)')
on conflict (name_lower, org) do update set
  org_rank = excluded.org_rank,
  mlb_top100 = excluded.mlb_top100,
  mlb_rank = excluded.mlb_rank,
  prospect_info = excluded.prospect_info,
  updated_at = now();
