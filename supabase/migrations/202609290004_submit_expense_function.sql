-- Creates expenses atomically and applies the required automatic overhead allocation.
create or replace function public.submit_expense(
  p_actor_employee_id uuid,
  p_reference text,
  p_description text,
  p_category public.expense_category,
  p_amount_cents bigint,
  p_proposed_allocation public.expense_allocation,
  p_source public.transaction_source,
  p_submission_telegram_chat_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_actor_role public.employee_role;
  v_recipient_chat_id bigint;
begin
  select role
  into v_actor_role
  from public.employees
  where id = p_actor_employee_id and active = true;

  if v_actor_role is null then
    raise exception 'The selected employee is inactive or does not exist.' using errcode = 'P0001';
  end if;

  if v_actor_role <> 'expense_reporter' then
    raise exception 'Only Kevin can submit expenses.' using errcode = 'P0001';
  end if;

  if p_reference is null or p_reference !~ '^[A-Za-z][A-Za-z0-9_-]{0,49}$' then
    raise exception 'Reference must start with a letter and contain only letters, numbers, underscores, or hyphens.' using errcode = 'P0001';
  end if;

  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'Expense description is required.' using errcode = 'P0001';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Expense amount must be greater than zero.' using errcode = 'P0001';
  end if;

  if p_source = 'telegram' and p_submission_telegram_chat_id is null then
    raise exception 'Telegram submissions require the originating chat.' using errcode = 'P0001';
  end if;

  if p_source = 'website' then
    select last_chat_id
    into v_recipient_chat_id
    from public.telegram_identities
    where employee_id = p_actor_employee_id and active = true;
  else
    v_recipient_chat_id := p_submission_telegram_chat_id;
  end if;

  insert into public.transactions (
    reference,
    submitted_by_employee_id,
    source,
    submission_telegram_chat_id,
    website_recipient_chat_id
  ) values (
    upper(trim(p_reference)),
    p_actor_employee_id,
    p_source,
    p_submission_telegram_chat_id,
    v_recipient_chat_id
  ) returning id into v_transaction_id;

  if p_proposed_allocation = 'company_overhead' then
    insert into public.expenses (
      transaction_id, description, category, amount_cents, proposed_allocation,
      final_allocation, status, allocated_at
    ) values (
      v_transaction_id, trim(p_description), p_category, p_amount_cents, p_proposed_allocation,
      'company_overhead', 'allocated_overhead', now()
    );

    insert into public.expense_allocation_decisions (
      expense_id, final_allocation, allocation_changed, automatic
    ) values (
      v_transaction_id, 'company_overhead', false, true
    );
  else
    insert into public.expenses (
      transaction_id, description, category, amount_cents, proposed_allocation, status
    ) values (
      v_transaction_id, trim(p_description), p_category, p_amount_cents, p_proposed_allocation,
      'awaiting_allocation'
    );
  end if;

  insert into public.sheets_sync_state (transaction_id, tab_name)
  values (v_transaction_id, 'Expenses');

  insert into public.telegram_notification_state (transaction_id, notification_kind, chat_id, status)
  values (
    v_transaction_id,
    'submission_confirmation',
    v_recipient_chat_id,
    case
      when v_recipient_chat_id is null then 'not_applicable'::public.notification_status
      else 'pending'::public.notification_status
    end
  );

  return v_transaction_id;
exception
  when unique_violation then
    raise exception 'A transaction with this reference already exists.' using errcode = 'P0001';
end;
$$;

revoke all on function public.submit_expense from public;
grant execute on function public.submit_expense to service_role;
