# FamilyLedger 優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在複製版 `/Users/minalover/family-ledger-optimized` 上，改善首屏載入、修補 Supabase RLS 安全漏洞、消除重複的 auth 訂閱與無謂 re-render，並統一 PWA manifest——全程不動原版、不改動共用的線上 Supabase 資料。

**Architecture:** 純前端改動（lazy split / memo / useAuth 單例 / manifest）可由 `npm run build` + `npm test` + dev server 驗證。資料庫改動（RLS）只**新增 migration SQL 檔並做語法/邏輯審查**，**不套用到線上 Supabase**（複製版與原版共用同一個 Supabase 後端，套用會同時影響原版正在使用的資料）——是否套用由使用者在決定取代原版時自行執行。

**Tech Stack:** Vite 5 + React 18 + TypeScript 5 + Tailwind 3 + Supabase JS 2 + Zustand 4 + Vitest 2 + vite-plugin-pwa

## Global Constraints

- 只在 `/Users/minalover/family-ledger-optimized` 內操作；原版 `/Users/minalover/family-ledger` 一個位元都不能改。
- **不得對線上 Supabase 執行任何 migration 或資料異動**（共用後端）。RLS 任務只產出 `.sql` 檔。
- 每個前端任務結束須通過 `npm run build`（含 `tsc -b`）與 `npm test`（目前 68 測試全綠）。
- 繁體中文 docstring/註解，風格沿用既有檔案。
- 在複製版開新分支 `optimize/2026-06-28` 進行，frequent commits。

---

### Task 0: 建立工作分支

**Files:**
- 無檔案異動，僅 git 操作

- [ ] **Step 1: 在複製版開分支**

```bash
cd /Users/minalover/family-ledger-optimized
git checkout -b optimize/2026-06-28
git status
```
Expected: `On branch optimize/2026-06-28`，working tree 乾淨（`docs/.../2026-06-28-family-ledger-optimization.md` 為新檔，先 commit 計畫本身）

- [ ] **Step 2: Commit 計畫**

```bash
git add docs/superpowers/plans/2026-06-28-family-ledger-optimization.md
git commit -m "docs: 加入 2026-06-28 優化實作計畫"
```

---

### Task 1: Route-level lazy split（P1 + B2）

打掉單一 514KB chunk：把非首屏路由改成 `React.lazy` 動態載入，並用 `Suspense` 包住。

**Files:**
- Modify: `src/App.tsx`（整檔改寫 import 與 Routes）

**Interfaces:**
- Consumes: 既有頁面元件需可被 `React.lazy` 載入。`Dashboard`/`LedgerPage`/`Settings`/`QuickAdd` 目前是 **named export**（`export function Dashboard`…），`React.lazy` 需要 default export，故每個 lazy 載入處要轉接 `.then(m => ({ default: m.XXX }))`。
- Produces: `App` 仍為 default export，路由行為不變。

- [ ] **Step 1: 改寫 `src/App.tsx`**

```tsx
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { Toast } from './components/common/Toast';

// 首屏外的路由全部動態載入，避免單一 bundle 過大
const AuthLayout = lazy(() => import('./pages/auth/AuthLayout').then((m) => ({ default: m.AuthLayout })));
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })));
const JoinFamily = lazy(() => import('./pages/auth/JoinFamily').then((m) => ({ default: m.JoinFamily })));
const CompleteOnboarding = lazy(() =>
  import('./pages/auth/CompleteOnboarding').then((m) => ({ default: m.CompleteOnboarding }))
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const LedgerPage = lazy(() => import('./pages/LedgerPage').then((m) => ({ default: m.LedgerPage })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const QuickAdd = lazy(() => import('./pages/QuickAdd').then((m) => ({ default: m.QuickAdd })));

const Fallback = (
  <div className="grid min-h-screen place-items-center bg-page text-slate-500">載入中...</div>
);

function ProtectedRoute() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-page text-slate-500">載入家帳中...</div>;
  }
  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }
  if (!profile) {
    return <Navigate to="/auth/complete" replace />;
  }
  return <AppShell />;
}

export default function App() {
  return (
    <>
      <Toast />
      <Suspense fallback={Fallback}>
        <Routes>
          <Route path="/quick" element={<QuickAdd />} />
          <Route path="/auth" element={<AuthLayout />}>
            <Route index element={<Navigate to="/auth/login" replace />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="join" element={<JoinFamily />} />
            <Route path="complete" element={<CompleteOnboarding />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="family" element={<LedgerPage ledgerType="family" />} />
            <Route path="personal" element={<LedgerPage ledgerType="personal" />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
```

- [ ] **Step 2: 建置驗證 chunk 已分割**

Run: `npm run build`
Expected: 成功；輸出不再是單一 ~510KB chunk，而是多個 `assets/*.js`（每頁各一），且不再出現 `Some chunks are larger than 500 kB` 警告（或顯著縮小）。

- [ ] **Step 3: 測試與 lint 不退步**

Run: `npm test && npm run lint`
Expected: 68 測試全 PASS，lint 無錯。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "perf(bundle): 路由改 React.lazy 動態載入，分割 514KB 單一 chunk"
```

---

### Task 2: 補 budgets 寫入 RLS policy（S1）

`budgets` 已 `enable row level security` 並 grant insert/update/delete，但只建了 SELECT policy → RLS 預設拒絕，未來預算功能寫入會被 DB 靜默擋下。新增 migration 補上。**只寫檔，不套用。**

**Files:**
- Create: `supabase/migrations/003_budgets_write_policies.sql`

- [ ] **Step 1: 建立 migration**

```sql
-- 補齊 budgets 的寫入 RLS：原 001 僅有 SELECT policy，
-- INSERT/UPDATE/DELETE 在 RLS 啟用下會被預設拒絕。
-- 規則對齊 transactions：家庭預算限同家庭、個人預算限本人。

drop policy if exists "家庭成員可新增預算" on public.budgets;
create policy "家庭成員可新增預算" on public.budgets
  for insert with check (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid() and family_id = public.get_my_family_id())
  );

drop policy if exists "家庭成員可更新預算" on public.budgets;
create policy "家庭成員可更新預算" on public.budgets
  for update using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  ) with check (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );

drop policy if exists "家庭成員可刪除預算" on public.budgets;
create policy "家庭成員可刪除預算" on public.budgets
  for delete using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );
```

- [ ] **Step 2: 語法檢查（不連線、不套用）**

審查項目（人工 checklist，逐項確認）：
- policy 名稱與既有 001 不重複、`drop if exists` 先行可重跑（idempotent）。
- INSERT `with check` 同時涵蓋 family/personal 兩種 ledger_type。
- 對齊既有 transactions policy 的條件寫法（`public.get_my_family_id()` / `auth.uid()`）。

Expected: 三項皆符合。**不執行** `supabase db push` 或任何連線指令。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_budgets_write_policies.sql
git commit -m "fix(rls): 補 budgets INSERT/UPDATE/DELETE policy（修預算寫入被 DB 擋）"
```

---

### Task 3: 收緊 families 讀取權限（S2 + S3）

`grant select on families to anon` + policy `using(true)` → 任何人（含未登入）可讀全部家庭含 `invite_code`，等同邀請碼外洩。改為：撤掉 anon 對 families/transactions 的 select grant、members 只能讀自己家庭、邀請碼查詢改走 `SECURITY DEFINER` 函式；前端 join 流程改呼叫該函式。**migration 只寫不套用**；前端改動以單元測試（mock）驗證。

**Files:**
- Create: `supabase/migrations/004_harden_families_access.sql`
- Modify: `src/hooks/useAuth.ts:95-108`（join 分支改用 RPC）
- Test: `src/hooks/useAuth.rpc.test.ts`（新增，驗證 join 分支呼叫 RPC）

**Interfaces:**
- Produces（DB）：`public.find_family_by_invite(code text) returns table (id uuid, name text)`，`security definer`，grant execute to authenticated。
- Consumes（前端）：`supabase.rpc('find_family_by_invite', { code })` 回傳 `{ data: Array<{ id: string; name: string }>, error }`。

- [ ] **Step 1: 建立 migration**

```sql
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
```

- [ ] **Step 2: 改 `src/hooks/useAuth.ts` join 分支（第 95-108 行區塊）**

把現有：
```ts
      } else {
        const response = await supabase
          .from('families')
          .select('*')
          .eq('invite_code', inviteCode?.trim().toUpperCase() ?? '')
          .single();

        if (response.error || !response.data) {
          throw new Error('找不到這組邀請碼，請確認大小寫與數字。');
        }

        familyData = response.data;
        familyId = response.data.id;
      }
```
改為：
```ts
      } else {
        const { data, error } = await supabase.rpc('find_family_by_invite', {
          code: inviteCode?.trim().toUpperCase() ?? ''
        });

        const match = Array.isArray(data) ? data[0] : data;
        if (error || !match) {
          throw new Error('找不到這組邀請碼，請確認大小寫與數字。');
        }

        familyData = match;
        familyId = match.id;
      }
```

- [ ] **Step 3: 寫失敗測試**

建立 `src/hooks/useAuth.rpc.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) }
}));

// 只測 join 分支對 RPC 的呼叫契約（純函式抽出版本，見 Step 4）
import { resolveInviteFamily } from './useAuth';

describe('resolveInviteFamily', () => {
  beforeEach(() => rpc.mockReset());

  it('用正規化後的邀請碼呼叫 find_family_by_invite', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'fam-1', name: '我們的家' }], error: null });
    const family = await resolveInviteFamily(' ab12cd ');
    expect(rpc).toHaveBeenCalledWith('find_family_by_invite', { code: 'AB12CD' });
    expect(family).toEqual({ id: 'fam-1', name: '我們的家' });
  });

  it('查無邀請碼時丟出友善錯誤', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(resolveInviteFamily('ZZZZZZ')).rejects.toThrow('找不到這組邀請碼');
  });
});
```

- [ ] **Step 4: 跑測試確認 FAIL，然後抽出 `resolveInviteFamily` 並讓測試通過**

Run: `npm test -- useAuth.rpc`
Expected first: FAIL（`resolveInviteFamily` is not a function）

在 `src/hooks/useAuth.ts` 模組層（`useAuth` 之外）新增並 export：
```ts
export async function resolveInviteFamily(rawCode: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.rpc('find_family_by_invite', {
    code: rawCode?.trim().toUpperCase() ?? ''
  });
  const match = Array.isArray(data) ? data[0] : data;
  if (error || !match) {
    throw new Error('找不到這組邀請碼，請確認大小寫與數字。');
  }
  return match as { id: string; name: string };
}
```
並把 Step 2 的 join 分支改成呼叫 `resolveInviteFamily(inviteCode ?? '')`：
```ts
      } else {
        familyData = await resolveInviteFamily(inviteCode ?? '');
        familyId = familyData.id;
      }
```

Run again: `npm test -- useAuth.rpc`
Expected: PASS（2 tests）

- [ ] **Step 5: 全測試 + build + lint**

Run: `npm test && npm run build && npm run lint`
Expected: 全綠（70 測試）。

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/004_harden_families_access.sql src/hooks/useAuth.ts src/hooks/useAuth.rpc.test.ts
git commit -m "fix(rls): families 改 SECURITY DEFINER 查邀請碼、撤 anon 讀取權，join 流程改用 RPC"
```

> ⚠️ **採用注意**：Task 2/3 的 migration 套用到線上 Supabase 後才會真正生效。套用前請先在 Supabase SQL Editor 以測試帳號驗證 join 流程仍可用。本計畫不在此階段套用。

---

### Task 4: useAuth 單一訂閱（P2）

目前 `useAuth()` 內含 auth 訂閱 `useEffect`，9 個元件各呼叫一次 → 9 份重複訂閱 + 重複 `loadProfile`。改為：訂閱抽到只在 `App` 掛載一次的 `useAuthListener`；`useAuth` 不再含 effect，只讀 store + 提供動作。

**Files:**
- Create: `src/hooks/useAuthListener.ts`
- Modify: `src/hooks/useAuth.ts`（移除 useEffect、`loadProfile` 改用共用模組函式）
- Modify: `src/App.tsx`（在 `App()` 頂端呼叫 `useAuthListener()` 一次）
- Test: `src/hooks/loadProfileIntoStore.test.ts`（新增）

**Interfaces:**
- Produces: `loadProfileIntoStore(userId: string): Promise<void>`（模組函式，用 `useAuthStore.getState()` 寫入）；`useAuthListener(): void`。
- Consumes: `useAuthStore` 既有 setters（`setSession/setProfile/setFamily/setLoading/reset`）。

- [ ] **Step 1: 寫 `loadProfileIntoStore` 失敗測試**

建立 `src/hooks/loadProfileIntoStore.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';

const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock('../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => from(...a) } }));

import { loadProfileIntoStore } from './loadProfileIntoStore';

describe('loadProfileIntoStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ profile: null, family: null });
    single.mockReset();
  });

  it('讀到 profile 寫入 store', async () => {
    single.mockResolvedValueOnce({ data: { id: 'u1', family_id: null, display_name: '宇成' }, error: null });
    await loadProfileIntoStore('u1');
    expect(useAuthStore.getState().profile?.display_name).toBe('宇成');
  });

  it('profile 錯誤時清空 profile 與 family', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    await loadProfileIntoStore('u1');
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().family).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認 FAIL**

Run: `npm test -- loadProfileIntoStore`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 建立 `src/hooks/loadProfileIntoStore.ts`**

```ts
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// 把 profile（與其家庭）載入 authStore；供 useAuthListener 與 useAuth 動作共用，
// 避免每個呼叫 useAuth 的元件各自重複訂閱/載入。
export async function loadProfileIntoStore(userId: string): Promise<void> {
  const { setProfile, setFamily } = useAuthStore.getState();

  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    setProfile(null);
    setFamily(null);
    return;
  }

  setProfile(profileData);

  if (profileData.family_id) {
    const { data: familyData } = await supabase
      .from('families')
      .select('*')
      .eq('id', profileData.family_id)
      .single();
    setFamily(familyData ?? null);
  }
}
```

Run: `npm test -- loadProfileIntoStore`
Expected: PASS（2 tests）

- [ ] **Step 4: 建立 `src/hooks/useAuthListener.ts`**

```ts
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { loadProfileIntoStore } from './loadProfileIntoStore';

// 只在 App 根部掛載一次：負責 auth session 訂閱與 profile 載入，
// 取代原本散落在每個 useAuth() 呼叫點的重複訂閱。
export function useAuthListener(): void {
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user.id) {
        await loadProfileIntoStore(data.session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) {
        void loadProfileIntoStore(nextSession.user.id);
      } else {
        reset();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [reset, setLoading, setSession]);
}
```

- [ ] **Step 5: 從 `src/hooks/useAuth.ts` 移除 useEffect 與內嵌 loadProfile**

- 刪除 `useAuth` 內第 47-73 行的 `loadProfile` useCallback 與第 130-157 行的 useEffect。
- 將檔內所有 `loadProfile(...)` 呼叫（`createFamilyAndProfile` 內、`updateDisplayName` 內）改為 `loadProfileIntoStore(...)`。
- 在檔頭加入 `import { loadProfileIntoStore } from './loadProfileIntoStore';`，並從 `useAuthStore()` 解構移除不再需要的 `setFamily`（若已無其他用途，交由 lint 提示後移除）。
- `useAuth` 回傳物件中的 `loadProfile` 改指向 `loadProfileIntoStore`（保留同名 key，呼叫端不受影響）：
```ts
  return {
    session,
    user: session?.user ?? null,
    profile,
    family,
    loading,
    loadProfile: loadProfileIntoStore,
    signIn,
    // ...其餘不變
  };
```

- [ ] **Step 6: 在 `src/App.tsx` 掛載一次**

於 `export default function App()` 函式體第一行加入：
```tsx
export default function App() {
  useAuthListener();
  return (
    // ...
  );
}
```
並在檔頭 import：`import { useAuthListener } from './hooks/useAuthListener';`

- [ ] **Step 7: 全測試 + build + lint + 開發伺服器手動驗證登入態**

Run: `npm test && npm run build && npm run lint`
Expected: 全綠（72 測試）。

Run: `npm run dev`，瀏覽器開 dev 網址 → 確認：未登入導向 /auth/login；登入後 Dashboard 正常顯示 profile/family。（**唯讀驗證，勿新增/刪除真實交易**。）

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAuthListener.ts src/hooks/loadProfileIntoStore.ts src/hooks/loadProfileIntoStore.test.ts src/hooks/useAuth.ts src/App.tsx
git commit -m "perf(auth): 抽單一 useAuthListener、共用 loadProfileIntoStore，消除 9 份重複訂閱"
```

---

### Task 5: 列表/卡片 memo 化（P4 + P5 + P6 + P7）

消除每次 render 重建 callback/物件造成的整列重渲染。

**Files:**
- Modify: `src/components/transaction/TransactionList.tsx`（`React.memo` 包裹）
- Modify: `src/components/transaction/TransactionItem.tsx`（`React.memo` 包裹）
- Modify: `src/pages/Dashboard.tsx`（`useCallback` onEdit、`useMemo` 包 grouped slice）
- Modify: `src/pages/LedgerPage.tsx`（`useMemo` 包 `activeCurrencies`、`useCallback` onEdit）

- [ ] **Step 1: `TransactionItem` 改 `React.memo`**

在 `src/components/transaction/TransactionItem.tsx`：
- 檔頭 import 改 `import { memo } from 'react';`
- 將 `export function TransactionItem(...)` 改為內部 `function TransactionItemBase(...)`，檔尾加：
```tsx
export const TransactionItem = memo(TransactionItemBase);
```

- [ ] **Step 2: `TransactionList` 改 `React.memo`**

在 `src/components/transaction/TransactionList.tsx`：
- 檔頭 import 改 `import { memo } from 'react';`（與既有 type import 並存）
- 將 `export function TransactionList(...)` 改為 `function TransactionListBase(...)`，檔尾加：
```tsx
export const TransactionList = memo(TransactionListBase);
```

- [ ] **Step 3: `Dashboard.tsx` 穩定化 props**

- 檔頭：`import { useCallback, useMemo, useState } from 'react';`
- 在元件內新增穩定的 onEdit 與 grouped：
```tsx
  const handleSelectEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormLedgerType(transaction.ledger_type);
  }, []);

  const familyRecent = useMemo(
    () => ({ 最近: familyTransactions.transactions.slice(0, 5) }),
    [familyTransactions.transactions]
  );
  const personalRecent = useMemo(
    () => ({ 最近: personalTransactions.transactions.slice(0, 5) }),
    [personalTransactions.transactions]
  );
```
- 兩個 `<TransactionList>` 的 `groupedTransactions` 改用 `familyRecent`/`personalRecent`，`onEdit` 改用 `handleSelectEdit`。

- [ ] **Step 4: `LedgerPage.tsx` 穩定化**

- 檔頭已 import `useCallback, useState`；加上 `useMemo`。
- 將 `activeCurrencies` 的 IIFE 改為 `useMemo`：
```tsx
  const activeCurrencies = useMemo(() => {
    const active = (['TWD', 'USD'] as Currency[]).filter(
      (currency) =>
        analysis.summary.expense[currency] !== 0 ||
        analysis.summary.income[currency] !== 0 ||
        analysis.summary.balance[currency] !== 0
    );
    return active.length > 0 ? active : (['TWD'] as Currency[]);
  }, [analysis.summary]);
```
- 新增穩定 onEdit：
```tsx
  const handleSelectEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  }, []);
```
並把列表的 `onEdit={(transaction) => {...}}` 改為 `onEdit={handleSelectEdit}`。

- [ ] **Step 5: 全測試 + build + lint**

Run: `npm test && npm run build && npm run lint`
Expected: 全綠；無行為變化（純效能）。

- [ ] **Step 6: Commit**

```bash
git add src/components/transaction/TransactionList.tsx src/components/transaction/TransactionItem.tsx src/pages/Dashboard.tsx src/pages/LedgerPage.tsx
git commit -m "perf(render): 列表/卡片 memo 化、穩定 onEdit 與 grouped/activeCurrencies"
```

---

### Task 6: 統一 PWA manifest（B1）

`index.html:9` 連靜態 `/manifest.json`，vite-plugin-pwa 又生成 `manifest.webmanifest`，兩者已分歧。改為單一來源：由 vite-plugin-pwa 生成（補上 `purpose: 'any maskable'`），移除靜態檔與 index.html 的硬連結。

**Files:**
- Modify: `vite.config.ts`（icons 補 purpose）
- Modify: `index.html`（移除 `<link rel="manifest">`）
- Delete: `public/manifest.json`

- [ ] **Step 1: `vite.config.ts` icons 補 purpose**

將 manifest.icons 改為：
```ts
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
```

- [ ] **Step 2: `index.html` 移除靜態 manifest 連結**

刪除第 9 行：`<link rel="manifest" href="/manifest.json" />`（vite-plugin-pwa 會自動注入生成的 manifest 連結）。

- [ ] **Step 3: 刪除靜態 manifest**

```bash
git rm public/manifest.json
```

- [ ] **Step 4: 建置驗證單一 manifest**

Run: `npm run build`
Expected: 成功；`dist/` 只有 `manifest.webmanifest`、無 `manifest.json`；`dist/index.html` 內 manifest 連結指向 `manifest.webmanifest`（僅一個）。

- [ ] **Step 5: 測試 + lint**

Run: `npm test && npm run lint`
Expected: 全綠。

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts index.html
git commit -m "fix(pwa): 統一 manifest 來源由 vite-plugin-pwa 生成、補 maskable icon"
```

---

### Task 7: 最終整體驗證

**Files:** 無

- [ ] **Step 1: 全套驗證**

Run: `npm run build && npm test && npm run lint`
Expected: build 成功、72 測試全綠、lint 無錯。

- [ ] **Step 2: bundle 體積對照**

比較 Task 1 前後 `dist/assets/*.js`：確認最大單一 chunk 明顯下降、初始載入只含首屏所需。

- [ ] **Step 3: 撰寫變更摘要**

於 `docs/superpowers/plans/` 或回報訊息列出：完成項目、未套用的 DB migration 清單（003/004，待採用時執行）、與原版差異。**不自動合併、不取代原版——交由使用者決定。**

---

## Self-Review

**Spec coverage：** 七項分析發現對應——P1→Task1、S1→Task2、S2/S3→Task3、P2→Task4、P4-P7→Task5、B1/B2→Task1+Task6。第 7 項（U2 undo-delete）經複查為**非 bug**，已從計畫移除並於交付時向使用者說明（見下方替代建議）。

**Placeholder scan：** 各步驟均含實際程式碼/SQL/指令與預期輸出，無 TBD。

**Type consistency：** `loadProfileIntoStore(userId: string)`、`resolveInviteFamily(rawCode: string)`、`find_family_by_invite(code)` 回傳 `{ id, name }` 於 migration 與前端一致；`useAuth` 回傳 `loadProfile` key 維持不變、呼叫端不受影響。

## 第 7 項替代建議（待使用者決定）

U2 既非 bug，建議用同等小成本的真實項目補上其一：
- **U4**：`src/lib/invite.ts:4` 邀請連結硬編 production URL，本地/預覽分享會錯 → 改讀 `window.location.origin`。
- **U6**：`src/pages/QuickAdd.tsx:67` 直接顯示 Supabase 原始錯誤 → 套用既有 `getErrorMessage` 翻譯。
- 或維持 6 項即可。
