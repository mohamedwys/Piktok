-- Conversations: one per (product, buyer) pair.
create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations(buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations(seller_user_id, last_message_at desc);
create index conversations_product_idx on public.conversations(product_id);

-- Messages within a conversation.
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  kind text not null default 'text' check (kind in ('text','offer')),
  offer_amount numeric(10,2),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations: participants can SELECT.
create policy "conversations select own" on public.conversations
  for select using (auth.uid() = buyer_id or auth.uid() = seller_user_id);

-- Conversations: only authenticated user that becomes buyer can INSERT directly.
-- (Normally insertions happen via the RPC but allow direct insert for buyer.)
create policy "conversations insert own" on public.conversations
  for insert with check (auth.uid() = buyer_id);

-- Conversations: participants can UPDATE (e.g., the trigger updates fields, security definer bypasses RLS, but we add a policy too for direct app updates if needed).
create policy "conversations update own" on public.conversations
  for update using (auth.uid() = buyer_id or auth.uid() = seller_user_id);

-- Messages: SELECT only if user is a participant of the parent conversation.
create policy "messages select own" on public.messages
  for select using (
    conversation_id in (
      select id from public.conversations
      where buyer_id = auth.uid() or seller_user_id = auth.uid()
    )
  );

-- Messages: INSERT only by sender who is a participant.
create policy "messages insert own" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and conversation_id in (
      select id from public.conversations
      where buyer_id = auth.uid() or seller_user_id = auth.uid()
    )
  );

-- Trigger: update conversation summary on new message.
create or replace function public.on_message_inserted()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set last_message_at = NEW.created_at,
      last_message_preview = case
        when NEW.kind = 'offer' then '💶 ' || NEW.offer_amount::text
        else left(NEW.body, 80)
      end
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists messages_summary_sync on public.messages;
create trigger messages_summary_sync
after insert on public.messages
for each row execute function public.on_message_inserted();

-- RPC: start or fetch existing conversation for the current user against a product.
create or replace function public.start_or_get_conversation(p_product_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_user_id uuid;
  v_conversation_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Not authenticated';
  end if;

  select s.user_id into v_seller_user_id
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = p_product_id;

  if v_seller_user_id is null then
    raise exception 'Product or seller has no linked user account';
  end if;

  if v_seller_user_id = v_buyer_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  select id into v_conversation_id
  from public.conversations
  where product_id = p_product_id and buyer_id = v_buyer_id;

  if v_conversation_id is null then
    insert into public.conversations (product_id, buyer_id, seller_user_id)
    values (p_product_id, v_buyer_id, v_seller_user_id)
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.start_or_get_conversation(uuid) to authenticated;

-- Enable realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
