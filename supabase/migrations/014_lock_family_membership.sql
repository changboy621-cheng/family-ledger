-- 鎖住「加入哪個家庭」：
-- 過去 user_profiles 的 update 政策只檢查 id = auth.uid()，沒限制 family_id，
-- 任何登入者只要知道某家庭的 uuid（例如曾經是成員的人），就能把自己的 family_id
-- 改成該家庭，讀到全部家庭帳。
--
-- 改法：
-- 1. 前端不再直接寫 user_profiles.family_id，也不再直接 insert families。
-- 2. 建立家庭／用邀請碼加入家庭，改由 SECURITY DEFINER 函式完成，
--    加入一定要拿得出正確邀請碼。
-- 3. 欄位層級權限：前端只能更新 display_name、avatar_color、default_currency。

-- ---------- 建立家庭並綁定自己 ----------
create or replace function public.create_family_with_profile(
  p_display_name text,
  p_avatar_color text,
  p_default_currency text
)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family public.families;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 字，byte % 32 無偏差
  v_bytes bytea;
begin
  if v_uid is null then
    raise exception '請先登入，才能建立家庭。' using errcode = '28000';
  end if;

  for attempt in 1..5 loop
    -- gen_random_uuid() 來源為密碼學安全亂數，邀請碼不可預測
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % 32), 1);
    end loop;

    begin
      insert into public.families (name, invite_code)
      values ('我們的家', v_code)
      returning * into v_family;
      exit;
    exception when unique_violation then
      v_family := null;
    end;
  end loop;

  if v_family.id is null then
    raise exception '邀請碼產生失敗，請再試一次。';
  end if;

  insert into public.user_profiles (id, family_id, display_name, avatar_color, default_currency)
  values (v_uid, v_family.id, p_display_name, p_avatar_color, p_default_currency)
  on conflict (id) do update
    set family_id = excluded.family_id,
        display_name = excluded.display_name,
        avatar_color = excluded.avatar_color,
        default_currency = excluded.default_currency;

  return v_family;
end;
$$;

-- ---------- 用邀請碼加入家庭並綁定自己 ----------
create or replace function public.join_family_with_profile(
  p_code text,
  p_display_name text,
  p_avatar_color text,
  p_default_currency text
)
returns table (family_id uuid, family_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_family public.families;
begin
  if v_uid is null then
    raise exception '請先登入，才能加入家庭。' using errcode = '28000';
  end if;

  select f.* into v_family
  from public.families f
  where f.invite_code = upper(trim(p_code))
  limit 1;

  if v_family.id is null then
    raise exception '找不到這組邀請碼，請確認大小寫與數字。' using errcode = 'P0002';
  end if;

  insert into public.user_profiles (id, family_id, display_name, avatar_color, default_currency)
  values (v_uid, v_family.id, p_display_name, p_avatar_color, p_default_currency)
  on conflict (id) do update
    set family_id = excluded.family_id,
        display_name = excluded.display_name,
        avatar_color = excluded.avatar_color,
        default_currency = excluded.default_currency;

  return query select v_family.id, v_family.name;
end;
$$;

-- 函式預設 PUBLIC 可執行，收回後只給登入者
revoke all on function public.create_family_with_profile(text, text, text) from public, anon;
revoke all on function public.join_family_with_profile(text, text, text, text) from public, anon;
grant execute on function public.create_family_with_profile(text, text, text) to authenticated;
grant execute on function public.join_family_with_profile(text, text, text, text) to authenticated;

-- ---------- 收回前端直接寫入的權限 ----------
-- user_profiles：不能自己 insert，update 只限三個顯示用欄位（family_id 寫不動）
revoke insert, update on public.user_profiles from authenticated, anon;
grant update (display_name, avatar_color, default_currency) on public.user_profiles to authenticated;
drop policy if exists "使用者可建立自己的 profile" on public.user_profiles;

-- families：不能自己 insert（只能透過 create_family_with_profile）
revoke insert on public.families from authenticated, anon;
drop policy if exists "登入者可建立家庭" on public.families;
