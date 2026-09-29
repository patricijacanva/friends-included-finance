-- Friends Included Finance: source-of-truth schema.
-- Execute this file once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.employee_role as enum ('manager', 'salesperson', 'expense_reporter');
create type public.project_code as enum ('A', 'B');
create type public.expense_category as enum ('materials', 'travel', 'other');
create type public.expense_allocation as enum ('A', 'B', 'company_overhead');
create type public.transaction_source as enum ('website', 'telegram');
create type public.sale_status as enum ('pending_approval', 'approved');
create type public.expense_status as enum ('awaiting_allocation', 'allocated_project', 'allocated_overhead');
create type public.sync_status as enum ('pending', 'failed', 'synced');
create type public.notification_status as enum ('pending', 'failed', 'sent', 'not_applicable');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('richard', 'anastasia', 'jean_claude', 'kevin', 'svetlana')),
  display_name text not null,
  role public.employee_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.employees (code, display_name, role) values
  ('richard', 'Richard “Call Me Dick” Darling', 'salesperson'),
  ('anastasia', 'Anastasia Ferrari', 'salesperson'),
  ('jean_claude', 'Jean-Claude Bērziņš', 'salesperson'),
  ('kevin', 'Kevin von Whatever', 'expense_reporter'),
  ('svetlana', 'Svetlana de Monte Carlo', 'manager');

create table public.telegram_chats (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null unique,
  telegram_user_id bigint not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_private_chat boolean not null default true
);

create table public.telegram_identities (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  employee_id uuid not null unique references public.employees(id),
  last_chat_id bigint references public.telegram_chats(telegram_chat_id),
  linked_by_employee_id uuid not null references public.employees(id),
  linked_at timestamptz not null default now(),
  active boolean not null default true
);

-- This parent table makes every reference globally unique, including across sales and expenses.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[A-Za-z][A-Za-z0-9_-]{0,49}$'),
  submitted_at timestamptz not null default now(),
  submitted_by_employee_id uuid not null references public.employees(id),
  source public.transaction_source not null,
  submission_telegram_chat_id bigint references public.telegram_chats(telegram_chat_id),
  website_recipient_chat_id bigint references public.telegram_chats(telegram_chat_id),
  check (
    (source = 'telegram' and submission_telegram_chat_id is not null) or
    (source = 'website')
  )
);

create table public.sales (
  transaction_id uuid primary key references public.transactions(id) on delete restrict,
  customer text not null check (length(trim(customer)) > 0),
  project public.project_code not null,
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  status public.sale_status not null default 'pending_approval',
  approved_at timestamptz,
  approved_by_employee_id uuid references public.employees(id),
  check ((status = 'approved') = (approved_at is not null))
);

create table public.sale_commission_proposals (
  sale_id uuid primary key references public.sales(transaction_id) on delete restrict,
  richard_percent integer not null check (richard_percent between 0 and 100),
  anastasia_percent integer not null check (anastasia_percent between 0 and 100),
  jean_claude_percent integer not null check (jean_claude_percent between 0 and 100),
  check (richard_percent + anastasia_percent + jean_claude_percent = 100)
);

create table public.sale_commission_decisions (
  sale_id uuid primary key references public.sales(transaction_id) on delete restrict,
  decided_by_employee_id uuid not null references public.employees(id),
  decided_at timestamptz not null default now(),
  richard_percent integer not null check (richard_percent between 0 and 100),
  anastasia_percent integer not null check (anastasia_percent between 0 and 100),
  jean_claude_percent integer not null check (jean_claude_percent between 0 and 100),
  pool_cents bigint not null check (pool_cents >= 0),
  richard_commission_cents bigint not null check (richard_commission_cents >= 0),
  anastasia_commission_cents bigint not null check (anastasia_commission_cents >= 0),
  jean_claude_commission_cents bigint not null check (jean_claude_commission_cents >= 0),
  split_changed boolean not null,
  check (richard_percent + anastasia_percent + jean_claude_percent = 100),
  check (richard_commission_cents + anastasia_commission_cents + jean_claude_commission_cents = pool_cents)
);

create table public.expenses (
  transaction_id uuid primary key references public.transactions(id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  category public.expense_category not null,
  amount_cents bigint not null check (amount_cents > 0),
  proposed_allocation public.expense_allocation not null,
  final_allocation public.expense_allocation,
  status public.expense_status not null,
  allocated_at timestamptz,
  allocated_by_employee_id uuid references public.employees(id),
  check (
    (status = 'awaiting_allocation' and final_allocation is null and allocated_at is null) or
    (status = 'allocated_project' and final_allocation in ('A', 'B') and allocated_at is not null) or
    (status = 'allocated_overhead' and final_allocation = 'company_overhead' and allocated_at is not null)
  )
);

create table public.expense_allocation_decisions (
  expense_id uuid primary key references public.expenses(transaction_id) on delete restrict,
  decided_by_employee_id uuid references public.employees(id),
  decided_at timestamptz not null default now(),
  final_allocation public.expense_allocation not null,
  allocation_changed boolean not null,
  automatic boolean not null default false,
  check ((automatic and decided_by_employee_id is null) or (not automatic and decided_by_employee_id is not null))
);

create table public.sheets_sync_state (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  tab_name text not null check (tab_name in ('Sales', 'Expenses')),
  status public.sync_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now()
);

create table public.telegram_notification_state (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  notification_kind text not null check (notification_kind in ('submission_confirmation', 'sale_approval', 'expense_allocation')),
  chat_id bigint references public.telegram_chats(telegram_chat_id),
  status public.notification_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (transaction_id, notification_kind),
  check ((status = 'sent') = (sent_at is not null))
);

create table public.manager_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_employee_id uuid references public.employees(id),
  action text not null,
  entity_type text not null check (entity_type in ('telegram_identity', 'sale', 'expense')),
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index transactions_submitted_by_idx on public.transactions (submitted_by_employee_id, submitted_at desc);
create index sales_status_idx on public.sales (status);
create index expenses_status_idx on public.expenses (status);
create index sheets_sync_state_status_idx on public.sheets_sync_state (status);
create index telegram_notification_state_status_idx on public.telegram_notification_state (status);

-- The application uses only server-side Supabase clients. These policies deny anonymous access.
alter table public.employees enable row level security;
alter table public.telegram_chats enable row level security;
alter table public.telegram_identities enable row level security;
alter table public.transactions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_commission_proposals enable row level security;
alter table public.sale_commission_decisions enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_allocation_decisions enable row level security;
alter table public.sheets_sync_state enable row level security;
alter table public.telegram_notification_state enable row level security;
alter table public.manager_audit_log enable row level security;

-- No browser-facing policies are created intentionally. The service-role backend bypasses RLS.
