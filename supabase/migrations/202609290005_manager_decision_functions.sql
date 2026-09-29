create or replace function public.approve_sale(
  p_actor_employee_id uuid,
  p_sale_id uuid,
  p_richard_percent integer,
  p_anastasia_percent integer,
  p_jean_claude_percent integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.employee_role;
  v_amount_cents bigint;
  v_status public.sale_status;
  v_reference text;
  v_submission_chat_id bigint;
  v_website_recipient_chat_id bigint;
  v_old_richard integer;
  v_old_anastasia integer;
  v_old_jean_claude integer;
  v_pool_cents bigint;
  v_richard_cents bigint;
  v_anastasia_cents bigint;
  v_jean_claude_cents bigint;
  v_difference bigint;
  v_split_changed boolean;
  v_recipient_chat_id bigint;
begin
  select role into v_actor_role from public.employees where id = p_actor_employee_id and active = true;
  if v_actor_role is null or v_actor_role <> 'manager' then
    raise exception 'Only Svetlana can approve sales.' using errcode = 'P0001';
  end if;

  if p_richard_percent is null or p_anastasia_percent is null or p_jean_claude_percent is null
    or p_richard_percent not between 0 and 100
    or p_anastasia_percent not between 0 and 100
    or p_jean_claude_percent not between 0 and 100
    or p_richard_percent + p_anastasia_percent + p_jean_claude_percent <> 100 then
    raise exception 'Commission shares must each be 0 to 100 and total exactly 100.' using errcode = 'P0001';
  end if;

  select s.amount_cents, s.status, t.reference, t.submission_telegram_chat_id, t.website_recipient_chat_id
  into v_amount_cents, v_status, v_reference, v_submission_chat_id, v_website_recipient_chat_id
  from public.sales s
  join public.transactions t on t.id = s.transaction_id
  where s.transaction_id = p_sale_id
  for update of s;

  if not found then
    raise exception 'Sale not found.' using errcode = 'P0001';
  end if;
  if v_status <> 'pending_approval' then
    raise exception 'This sale has already been approved.' using errcode = 'P0001';
  end if;

  select richard_percent, anastasia_percent, jean_claude_percent
  into v_old_richard, v_old_anastasia, v_old_jean_claude
  from public.sale_commission_proposals
  where sale_id = p_sale_id;

  v_pool_cents := round(v_amount_cents::numeric * 0.10)::bigint;
  v_richard_cents := round(v_pool_cents::numeric * p_richard_percent / 100)::bigint;
  v_anastasia_cents := round(v_pool_cents::numeric * p_anastasia_percent / 100)::bigint;
  v_jean_claude_cents := round(v_pool_cents::numeric * p_jean_claude_percent / 100)::bigint;
  v_difference := v_pool_cents - v_richard_cents - v_anastasia_cents - v_jean_claude_cents;

  if p_richard_percent >= p_anastasia_percent and p_richard_percent >= p_jean_claude_percent then
    v_richard_cents := v_richard_cents + v_difference;
  elsif p_anastasia_percent >= p_jean_claude_percent then
    v_anastasia_cents := v_anastasia_cents + v_difference;
  else
    v_jean_claude_cents := v_jean_claude_cents + v_difference;
  end if;

  v_split_changed := p_richard_percent <> v_old_richard
    or p_anastasia_percent <> v_old_anastasia
    or p_jean_claude_percent <> v_old_jean_claude;

  update public.sales
  set status = 'approved', approved_at = now(), approved_by_employee_id = p_actor_employee_id
  where transaction_id = p_sale_id;

  insert into public.sale_commission_decisions (
    sale_id, decided_by_employee_id, richard_percent, anastasia_percent, jean_claude_percent,
    pool_cents, richard_commission_cents, anastasia_commission_cents, jean_claude_commission_cents, split_changed
  ) values (
    p_sale_id, p_actor_employee_id, p_richard_percent, p_anastasia_percent, p_jean_claude_percent,
    v_pool_cents, v_richard_cents, v_anastasia_cents, v_jean_claude_cents, v_split_changed
  );

  insert into public.manager_audit_log (actor_employee_id, action, entity_type, entity_id, before_state, after_state)
  values (
    p_actor_employee_id, 'sale_approved', 'sale', p_sale_id,
    jsonb_build_object('status', 'pending_approval', 'richard_percent', v_old_richard, 'anastasia_percent', v_old_anastasia, 'jean_claude_percent', v_old_jean_claude),
    jsonb_build_object('status', 'approved', 'richard_percent', p_richard_percent, 'anastasia_percent', p_anastasia_percent, 'jean_claude_percent', p_jean_claude_percent, 'pool_cents', v_pool_cents)
  );

  update public.sheets_sync_state
  set status = 'pending', error_message = null, updated_at = now()
  where transaction_id = p_sale_id;

  v_recipient_chat_id := coalesce(v_submission_chat_id, v_website_recipient_chat_id);
  insert into public.telegram_notification_state (transaction_id, notification_kind, chat_id, status)
  values (
    p_sale_id, 'sale_approval', v_recipient_chat_id,
    case when v_recipient_chat_id is null then 'not_applicable'::public.notification_status else 'pending'::public.notification_status end
  );

  return jsonb_build_object(
    'reference', v_reference, 'poolCents', v_pool_cents, 'richardCents', v_richard_cents,
    'anastasiaCents', v_anastasia_cents, 'jeanClaudeCents', v_jean_claude_cents, 'splitChanged', v_split_changed
  );
end;
$$;

create or replace function public.allocate_expense(
  p_actor_employee_id uuid,
  p_expense_id uuid,
  p_final_allocation public.expense_allocation
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.employee_role;
  v_status public.expense_status;
  v_proposed_allocation public.expense_allocation;
  v_amount_cents bigint;
  v_reference text;
  v_submission_chat_id bigint;
  v_website_recipient_chat_id bigint;
  v_changed boolean;
  v_recipient_chat_id bigint;
begin
  select role into v_actor_role from public.employees where id = p_actor_employee_id and active = true;
  if v_actor_role is null or v_actor_role <> 'manager' then
    raise exception 'Only Svetlana can allocate expenses.' using errcode = 'P0001';
  end if;

  select e.status, e.proposed_allocation, e.amount_cents, t.reference, t.submission_telegram_chat_id, t.website_recipient_chat_id
  into v_status, v_proposed_allocation, v_amount_cents, v_reference, v_submission_chat_id, v_website_recipient_chat_id
  from public.expenses e
  join public.transactions t on t.id = e.transaction_id
  where e.transaction_id = p_expense_id
  for update of e;

  if not found then
    raise exception 'Expense not found.' using errcode = 'P0001';
  end if;
  if v_status <> 'awaiting_allocation' then
    raise exception 'This expense has already been allocated.' using errcode = 'P0001';
  end if;

  v_changed := p_final_allocation <> v_proposed_allocation;

  update public.expenses
  set final_allocation = p_final_allocation,
      status = case when p_final_allocation = 'company_overhead' then 'allocated_overhead'::public.expense_status else 'allocated_project'::public.expense_status end,
      allocated_at = now(),
      allocated_by_employee_id = p_actor_employee_id
  where transaction_id = p_expense_id;

  insert into public.expense_allocation_decisions (
    expense_id, decided_by_employee_id, final_allocation, allocation_changed, automatic
  ) values (p_expense_id, p_actor_employee_id, p_final_allocation, v_changed, false);

  insert into public.manager_audit_log (actor_employee_id, action, entity_type, entity_id, before_state, after_state)
  values (
    p_actor_employee_id, 'expense_allocated', 'expense', p_expense_id,
    jsonb_build_object('status', 'awaiting_allocation', 'proposed_allocation', v_proposed_allocation),
    jsonb_build_object('status', case when p_final_allocation = 'company_overhead' then 'allocated_overhead' else 'allocated_project' end, 'final_allocation', p_final_allocation)
  );

  update public.sheets_sync_state
  set status = 'pending', error_message = null, updated_at = now()
  where transaction_id = p_expense_id;

  v_recipient_chat_id := coalesce(v_submission_chat_id, v_website_recipient_chat_id);
  insert into public.telegram_notification_state (transaction_id, notification_kind, chat_id, status)
  values (
    p_expense_id, 'expense_allocation', v_recipient_chat_id,
    case when v_recipient_chat_id is null then 'not_applicable'::public.notification_status else 'pending'::public.notification_status end
  );

  return jsonb_build_object('reference', v_reference, 'amountCents', v_amount_cents, 'changed', v_changed, 'finalAllocation', p_final_allocation);
end;
$$;

revoke all on function public.approve_sale from public;
revoke all on function public.allocate_expense from public;
grant execute on function public.approve_sale to service_role;
grant execute on function public.allocate_expense to service_role;
