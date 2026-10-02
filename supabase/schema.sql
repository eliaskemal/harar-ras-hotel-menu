create table
if
  not exists public.menu_state (
    id text primary key check (id = 'main')
    , data jsonb not null
    , updated_at timestamptz not null default now()
  );

  alter table public.menu_state
  enable row level
  security;
  grant
    all
  on public.menu_state
  to
    service_role;