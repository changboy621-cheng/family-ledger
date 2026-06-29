import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { deriveReferenceLoading, useReferenceStore } from '../store/referenceStore';

// 取得同一個家庭的所有成員，用於「幫誰記帳」的選單。
// 透過 referenceStore 快取，避免多個元件（Dashboard 兩個清單、表單等）各自重抓。
export function useFamilyMembers() {
  const familyId = useAuthStore((state) => state.profile?.family_id);
  const members = useReferenceStore((state) => state.members);
  const storeLoading = useReferenceStore((state) => state.membersLoading);
  const loadedFamilyId = useReferenceStore((state) => state.loadedMembersFamilyId);
  const error = useReferenceStore((state) => state.membersError);
  const ensureMembers = useReferenceStore((state) => state.ensureMembers);

  useEffect(() => {
    if (familyId) void ensureMembers(familyId);
  }, [familyId, ensureMembers]);

  return { members, loading: deriveReferenceLoading(storeLoading, loadedFamilyId, familyId, error) };
}
