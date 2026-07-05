import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || url.includes('placeholder')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL이 .env.local에 올바르게 설정되지 않았습니다.');
    }
    if (!key || key === 'placeholder-anon-key') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. Supabase Settings → API에서 service_role 키를 추가하세요.');
    }
    _admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return _admin;
}
