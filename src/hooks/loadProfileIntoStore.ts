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
