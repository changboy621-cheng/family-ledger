import { z } from 'zod';
import type { Category, Transaction, UserProfile } from '../types';
import type { EntryRow } from './suggestions';
import type { OnboardingDraft } from './onboarding';

// 外部資料邊界（Supabase 列、RPC、localStorage）的 runtime 驗證，
// 取代散落各處對未驗證資料的 `as Transaction[]` / `as unknown as` 等不安全轉型。

export const currencySchema = z.enum(['TWD', 'USD']);
export const ledgerTypeSchema = z.enum(['family', 'personal']);
export const transactionTypeSchema = z.enum(['expense', 'income']);
export const paymentMethodSchema = z.enum(['cash', 'card']);

export const userProfileSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  display_name: z.string(),
  avatar_color: z.string().catch('#64748B'),
  default_currency: currencySchema.catch('TWD'),
  created_at: z.string().optional()
});

export const categorySchema = z.object({
  id: z.string(),
  family_id: z.string().nullish(),
  owner_id: z.string().nullish(),
  name: z.string(),
  icon: z.string().catch('🏷️'),
  type: transactionTypeSchema,
  is_shared: z.boolean().catch(false),
  sort_order: z.number().nullish()
});

export const transactionSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  owner_id: z.string(),
  recorded_by: z.string().nullish(),
  ledger_type: ledgerTypeSchema,
  type: transactionTypeSchema,
  amount: z.number(),
  currency: currencySchema,
  category_id: z.string(),
  note: z.string().nullish(),
  payment_method: paymentMethodSchema.nullish(),
  transaction_date: z.string(),
  receipt_url: z.string().nullish(),
  // join 出來的巢狀資料若壞掉，退回 null 而非整列丟棄。
  created_at: z.string().catch(''),
  updated_at: z.string().catch(''),
  category: categorySchema.nullish().catch(null),
  owner: userProfileSchema.nullish().catch(null)
});

export const entryRowSchema = z.object({
  category_id: z.string(),
  note: z.string().nullish().catch(null),
  transaction_date: z.string().optional(),
  category: z.object({ name: z.string(), icon: z.string() }).nullish().catch(null)
});

export const onboardingDraftSchema = z.object({
  mode: z.enum(['create', 'join']),
  displayName: z.string(),
  defaultCurrency: currencySchema,
  inviteCode: z.string().optional(),
  email: z.string().optional(),
  requiresEmailVerification: z.boolean().optional()
});

export const inviteFamilySchema = z.object({ id: z.string(), name: z.string() });

/** 逐列安全解析：丟棄不符結構的列並記錄，避免單一壞資料讓整個畫面崩潰或被迫用 unsafe cast。 */
function safeParseRows<T>(schema: z.ZodTypeAny, data: unknown, label: string): T[] {
  if (!Array.isArray(data)) return [];
  const out: T[] = [];
  for (const row of data) {
    const result = schema.safeParse(row);
    if (result.success) out.push(result.data as T);
    else console.warn(`[schemas] 丟棄不符結構的${label}資料列`, result.error.issues);
  }
  return out;
}

export const parseTransactions = (data: unknown): Transaction[] =>
  safeParseRows<Transaction>(transactionSchema, data, '交易');
export const parseCategories = (data: unknown): Category[] =>
  safeParseRows<Category>(categorySchema, data, '分類');
export const parseUserProfiles = (data: unknown): UserProfile[] =>
  safeParseRows<UserProfile>(userProfileSchema, data, '成員');
export const parseEntryRows = (data: unknown): EntryRow[] =>
  safeParseRows<EntryRow>(entryRowSchema, data, '建議');

export function parseOnboardingDraft(raw: unknown): OnboardingDraft | null {
  const result = onboardingDraftSchema.safeParse(raw);
  return result.success ? (result.data as OnboardingDraft) : null;
}

export function parseInviteFamily(raw: unknown): { id: string; name: string } | null {
  const result = inviteFamilySchema.safeParse(raw);
  return result.success ? result.data : null;
}
