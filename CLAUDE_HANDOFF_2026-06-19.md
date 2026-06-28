# FamilyLedger Claude Handoff

## Project Overview

- Project name: `FamilyLedger`
- Location: `/Users/minalover/family-ledger`
- Stack:
  - React 18
  - TypeScript
  - Vite
  - Tailwind CSS
  - Supabase
  - Zustand
  - Vitest
- Scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm run test`

## Live URLs

- Recommended public share URL:
  - `https://family-ledger-wheat.vercel.app`
- Current single deployment URL that was used during debugging:
  - `https://family-ledger-nke1wbfrl-mack-mina.vercel.app`

Important:
- The user discovered that sharing the deployment-style URL could redirect external users into Vercel-related flows.
- The safer URL to share with family members is `https://family-ledger-wheat.vercel.app`.

## Deployment Notes

- Hosting is on Vercel under the `MackMina` workspace.
- Earlier deployments were blocked because:
  - Hobby plan
  - private repo
  - Vercel treated commit authorship as collaboration
- This was worked around by:
  1. making the GitHub repo public
  2. recreating the Vercel project
- A successful deployment was later confirmed as:
  - commit `997e941`
  - status `Ready`

## Repo / Git State

- Current branch: `main`
- Recent commits:
  - `3af2bba` Add success and error toast feedback
  - `942b569` Add transaction delete flow
  - `997e941` Fix duplicate realtime channel crash
  - `839a107` Fix amount input and ledger white screen
  - `469f4ac` Initial FamilyLedger app

## Current Uncommitted Changes

At the time of handoff, there are local database-policy changes not yet committed:

- Modified:
  - `supabase/migrations/001_initial_schema.sql`
- New file:
  - `supabase/migrations/002_allow_family_members_delete_family_transactions.sql`

## What Has Been Built

### P0 Core App

- Email/password authentication via Supabase
- Family creation flow
- Family join flow by invite code
- Complete onboarding flow
- Family ledger
- Personal ledger
- Transaction create form
- TWD / USD currency handling
- PWA setup

### Analysis Features

- Monthly category breakdown
- Family spender analysis
- Percentage bars
- Top 3 spending categories
- Daily spending trend
- Six-month spending trend
- Personal ledger category analysis

### Transaction Management

- Create transaction
- Edit transaction
- Delete transaction
- Toast feedback for success / error

## Key Fixes Already Done

### 1. Auth / onboarding fixes

- Better onboarding flow after Supabase auth
- Added complete onboarding route/page
- Improved user-facing error messages

### 2. White screen bug

Root cause:
- duplicate Supabase realtime channel naming
- family ledger page mounted multiple listeners with the same channel name
- caused runtime error:
  - `cannot add postgres_changes callbacks ... after subscribe()`

Fix:
- `src/hooks/useRealtimeSync.ts`
- changed channel naming to use a unique suffix via `useRef`

### 3. Amount input issue

Problem:
- user could not fully clear amount input
- malformed input handling was poor

Fix:
- added input sanitization
- allow empty string
- better TWD / USD filtering

Files:
- `src/lib/currency.ts`
- `src/components/common/AmountInput.tsx`

### 4. Defensive UI stability

- Added render error boundary
- Added safer date parsing in ledger analysis

Files:
- `src/components/common/ErrorBoundary.tsx`
- `src/hooks/useLedgerAnalysis.ts`

## Important Product / UX Notes

### Delete button visibility

The user recently thought delete was missing.

Actual behavior:
- delete/edit controls are on each transaction row
- not on the homepage summary cards
- if there are no recent transactions rendered, there is nothing to click

Files involved:
- `src/components/transaction/TransactionItem.tsx`
- `src/components/transaction/TransactionList.tsx`

### Family sharing behavior

The user wants to share this with their wife.

Important clarification:
- wife does **not** need a Vercel account
- wife should use the FamilyLedger site and create/join a family in-app
- she should use the public site URL and family invite code

## Supabase / Database Notes

### Existing policy situation

Originally:
- transaction deletion was only allowed for the transaction owner

User request:
- for family ledger, any family member should be able to delete family transactions
- personal ledger should remain owner-only

### Pending SQL change

This has been prepared locally but not fully finalized in deployment workflow:

File:
- `supabase/migrations/002_allow_family_members_delete_family_transactions.sql`

SQL content:

```sql
drop policy if exists "僅可刪除自己的交易" on public.transactions;

create policy "僅可刪除自己的交易" on public.transactions
  for delete using (
    (ledger_type = 'family' and family_id = public.get_my_family_id())
    or (ledger_type = 'personal' and owner_id = auth.uid())
  );
```

If Claude continues this work, check whether:
- user has already manually applied this in Supabase SQL Editor
- policy now behaves as intended in production

## Verification History

Multiple times during this session, the following were run and passed after feature/fix changes:

- `npm run build`
- `npm run lint`
- `npm run test`

This was true after:
- analysis features
- white screen fix
- delete flow
- edit flow
- toast notifications

## Likely Next Steps For Claude

### Highest priority

1. Verify the currently deployed production site is actually running the latest commit that includes:
   - delete flow
   - edit flow
   - toast feedback
2. Verify whether the public share URL:
   - `https://family-ledger-wheat.vercel.app`
   behaves correctly for external users
3. Verify whether the family-delete policy has been applied in Supabase

### If delete still fails

Check:
- whether production code includes delete button UI
- whether transactions rendered on the page belong to current month / visible list
- whether Supabase RLS policy has been updated in the live database
- whether frontend is showing a hidden error toast / failed delete request

### Good product follow-ups

- budget feature
- export CSV / Excel
- undo-delete flow
- improved invite-code discoverability
- clean up PWA / manifest warnings

## Important Files To Read First

- `src/hooks/useTransactions.ts`
- `src/hooks/useRealtimeSync.ts`
- `src/components/transaction/TransactionForm.tsx`
- `src/components/transaction/TransactionItem.tsx`
- `src/components/transaction/TransactionList.tsx`
- `src/pages/LedgerPage.tsx`
- `src/pages/Dashboard.tsx`
- `src/store/uiStore.ts`
- `src/components/common/Toast.tsx`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_allow_family_members_delete_family_transactions.sql`

## Current Ask From User

The user explicitly wants to hand off this context to Claude so Claude can make another version.

So the most useful next move for Claude is:
- first verify production vs local state
- then continue feature work or variant-building from this current app baseline
