create or replace function public.link_telegram_identity(
  p_actor_employee_id uuid,
  p_telegram_user_id bigint,
  p_employee_id uuid,
  p_telegram_chat_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.employee_role;
  v_chat_user_id bigint;
  v_before_state jsonb;
  v_identity_id uuid;
begin
  select role into v_actor_role from public.employees where id = p_actor_employee_id and active = true;
  if v_actor_role is null or v_actor_role <> 'manager' then
    raise exception 'Only Svetlana can link Telegram identities.' using errcode = 'P0001';
  end if;

  select telegram_user_id into v_chat_user_id
  from public.telegram_chats
  where telegram_chat_id = p_telegram_chat_id and is_private_chat = true;
  if v_chat_user_id is null or v_chat_user_id <> p_telegram_user_id then
    raise exception 'This private Telegram chat has not started the bot for this Telegram user.' using errcode = 'P0001';
  end if;

  select jsonb_agg(jsonb_build_object('telegram_user_id', telegram_user_id, 'employee_id', employee_id, 'last_chat_id', last_chat_id))
  into v_before_state
  from public.telegram_identities
  where telegram_user_id = p_telegram_user_id or employee_id = p_employee_id;

  delete from public.telegram_identities
  where telegram_user_id = p_telegram_user_id or employee_id = p_employee_id;

  insert into public.telegram_identities (
    telegram_user_id, employee_id, last_chat_id, linked_by_employee_id, active
  ) values (
    p_telegram_user_id, p_employee_id, p_telegram_chat_id, p_actor_employee_id, true
  ) returning id into v_identity_id;

  insert into public.manager_audit_log (actor_employee_id, action, entity_type, entity_id, before_state, after_state)
  values (
    p_actor_employee_id, 'telegram_identity_linked', 'telegram_identity', v_identity_id, v_before_state,
    jsonb_build_object('telegram_user_id', p_telegram_user_id, 'employee_id', p_employee_id, 'telegram_chat_id', p_telegram_chat_id)
  );
end;
$$;

revoke all on function public.link_telegram_identity from public;
grant execute on function public.link_telegram_identity to service_role;
