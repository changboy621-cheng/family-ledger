# FamilyLedger Monthly Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add monthly category analysis, top categories, and expense trends to both family and personal ledgers, plus spender analysis to the family ledger.

**Architecture:** Reuse the existing ledger transaction query and derive analysis from the in-memory monthly transaction set. Keep UI additions inside focused transaction analysis components and conditionally render spender analysis only on the family ledger.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- Keep TWD and USD fully separate with no currency conversion.
- Respect the existing `all / TWD / USD` filter behavior.
- Show family spender analysis only on the family ledger page.
- Add Top 3 category ranking and percentage bars without introducing a separate analytics page.
- Add daily current-month and rolling six-month expense trends for both ledgers.
- Preserve the current month picker, summary, transaction list, and add-transaction flow.

---

### Task 1: Add ledger analysis aggregation

**Files:**
- Create: `/Users/minalover/family-ledger/src/hooks/useLedgerAnalysis.ts`
- Create: `/Users/minalover/family-ledger/src/hooks/useLedgerAnalysis.test.ts`
- Modify: `/Users/minalover/family-ledger/src/types/index.ts`

**Interfaces:**
- Consumes: `Transaction[]`
- Produces: `useLedgerAnalysis(transactions: Transaction[], yearMonth: string): { summary, topCategories, expenseByCategory, expenseByOwner, dailyExpenseTrend, monthlyExpenseTrend }`

- [ ] Write failing aggregation tests for category totals, owner totals, top 3 ranking, and daily/monthly trend separation by currency.
- [ ] Run the test to verify the new hook is missing or incorrect.
- [ ] Implement the minimal aggregation hook and related analysis types.
- [ ] Run the targeted tests again until they pass.

### Task 2: Render analysis sections

**Files:**
- Create: `/Users/minalover/family-ledger/src/components/transaction/ExpenseCategorySummary.tsx`
- Create: `/Users/minalover/family-ledger/src/components/transaction/SpenderAnalysis.tsx`
- Create: `/Users/minalover/family-ledger/src/components/transaction/TopExpenseCategories.tsx`
- Create: `/Users/minalover/family-ledger/src/components/transaction/ExpenseTrendChart.tsx`

**Interfaces:**
- Consumes: `topCategories`, `expenseByCategory`, `expenseByOwner`, `dailyExpenseTrend`, `monthlyExpenseTrend`, `currencyFilter`
- Produces: category summary cards, spender cards, top-category rankings, and compact trend charts with empty states

- [ ] Add focused presentational components for category analysis, spender analysis, top categories, and compact trend charts.
- [ ] Keep the UI mobile-first and aligned with the existing ledger page style.
- [ ] Include meaningful empty states for months with no expense data.

### Task 3: Wire analysis into family and personal ledger pages

**Files:**
- Modify: `/Users/minalover/family-ledger/src/pages/LedgerPage.tsx`

**Interfaces:**
- Consumes: `useTransactions`, `useLedgerAnalysis`
- Produces: ledger page sections in the order `summary -> filters -> top categories -> category analysis -> spender analysis (family only) -> daily trend -> six-month trend -> transaction list`

- [ ] Replace the old summary source with the new ledger analysis hook.
- [ ] Show Top 3 categories on both family and personal ledgers.
- [ ] Show category analysis on both family and personal ledgers.
- [ ] Show spender analysis only on the family ledger.
- [ ] Show daily and six-month expense trend charts on both ledgers.
- [ ] Keep the existing transaction list and add button behavior unchanged.

### Task 4: Verify and stabilize

**Files:**
- Modify as needed: touched files above only

**Interfaces:**
- Consumes: completed code from Tasks 1-3
- Produces: passing tests and working production build

- [ ] Run targeted tests for the new analysis hook.
- [ ] Run the broader existing test set that covers current helper behavior.
- [ ] Run the production build and confirm the ledger pages still compile cleanly.
