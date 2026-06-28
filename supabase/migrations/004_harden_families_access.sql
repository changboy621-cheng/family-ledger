-- 收緊 families 讀取：移除 anon 讀取權、members 僅能讀自己家庭，
-- 邀請碼查詢改由 SECURITY DEFINER 函式提供（避免整表 invite_code 可被列舉）。

revoke select on public.families from anon;
revoke select on public.transactions from anon;

drop policy if exists "邀請碼可供註冊查詢" on public.families;
drop policy if exists "家庭成員可讀自己的家庭" on public.families;
create policy "家庭成員可讀自己的家庭" on public.families
  for select using (id = public.get_my_family_id());

-- 邀請碼解析：僅回傳 id 與名稱，不暴露整列；任何登入者可呼叫但只能用「精確 code」查到單筆。
create or replace function public.find_family_by_invite(code text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select f.id, f.name
  from public.families f
  where f.invite_code = upper(trim(code))
  limit 1
$$;

grant execute on function public.find_family_by_invite(text) to authenticated;
