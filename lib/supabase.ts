import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** placeholder가 아닌 실제 Supabase 프로젝트가 연결됐는지 */
export const isSupabaseLive =
  isSupabaseConfigured &&
  !supabaseUrl!.includes('placeholder') &&
  supabaseAnonKey !== 'placeholder-anon-key';

type SupabaseErr = { message?: string; code?: string; details?: string; hint?: string };

function formatSupabaseError(error: SupabaseErr): string {
  return [error.message, error.code && `(${error.code})`, error.details, error.hint].filter(Boolean).join(' — ');
}

if (!isSupabaseLive && typeof window !== 'undefined') {
  console.warn(
    '[DO:LAB] .env.local에 실제 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하면 ' +
      '일정·신청 API가 동작합니다.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
);

// ============================================
// 타입 정의 (새로운 스키마)
// ============================================

// 유저 정보
export type UserInfo = {
  id: string;
  name: string;
  phone: string;
  pin: string; // 전화번호 뒷 4자리 (자동 생성)
  nickname: string | null;
  password: string | null;
  credits: number;
  privacy_consent: boolean;
  privacy_consent_at: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  referrer_phone: string | null;
  created_at: string;
  updated_at: string;
};

// 게임 세션
export type Session = {
  session_id: string; // ex: 260211A0A1
  game_name: string;
  session_date: string;
  session_time: string;
  max_capacity: number;
  current_capacity: number;
  base_price: number;
  status: '모집중' | '마감';
  created_at: string;
  updated_at: string;
};

// 참가 신청
export type Apply = {
  id: string;
  user_id: string;
  session_id: string;
  used_credits: number;
  final_price: number;
  refund_policy_consent: boolean;
  refund_policy_consent_at: string | null;
  status: '신청중' | '확정' | '취소' | '환불';
  created_at: string;
  updated_at: string;
};

// 실시간 예약 현황 조회 결과
export type SessionAvailability = {
  session_id: string;
  game_name: string;
  session_date: string;
  session_time: string;
  current_capacity: number;
  max_capacity: number;
  available_slots: number;
  base_price: number;
  status: '모집중' | '마감';
};

// 유저 존재 여부 확인 결과
export type UserExistsResult = {
  user_exists: boolean;
  user_id: string | null;
  nickname: string | null;
  credits: number;
};

// ============================================
// 유틸리티 함수
// ============================================

// RPC fallback (service role API 실패 시)
async function checkUserExistsRpc(name: string, phone: string): Promise<UserExistsResult> {
  const { data, error } = await supabase.rpc('check_user_exists', {
    p_name: name,
    p_phone: phone,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    console.error('check_user_exists RPC error:', error?.message ?? error);
    throw new Error('유저 정보를 확인하는데 실패했습니다. .env.local의 Supabase 키를 확인해주세요.');
  }

  const row = data[0] as { user_exists: boolean; user_id: string | null; nickname: string | null; credits: number };
  return {
    user_exists: Boolean(row.user_exists),
    user_id: row.user_id ?? null,
    nickname: row.nickname ?? null,
    credits: row.credits ?? 0,
  };
}

// 유저 존재 여부 확인 (서버 API 우선, 실패 시 RPC fallback)
export async function checkUserExists(name: string, phone: string): Promise<UserExistsResult> {
  const trimmedName = name.trim();
  const normalizedPhone = phone.replace(/\D/g, '');

  try {
    const res = await fetch('/api/login/check-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName, phone: normalizedPhone }),
    });

    if (res.ok) {
      const data = (await res.json()) as UserExistsResult;
      return {
        user_exists: Boolean(data.user_exists),
        user_id: data.user_id ?? null,
        nickname: data.nickname ?? null,
        credits: data.credits ?? 0,
      };
    }

    const errBody = await res.json().catch(() => ({}));
    const apiError = (errBody as { error?: string }).error;
    console.warn('check-user API failed, trying RPC fallback:', apiError ?? res.status);
    return checkUserExistsRpc(trimmedName, normalizedPhone);
  } catch (err) {
    console.warn('check-user fetch failed, trying RPC fallback:', err);
    return checkUserExistsRpc(trimmedName, normalizedPhone);
  }
}

// 실시간 예약 현황 조회
export async function getSessionAvailability(): Promise<SessionAvailability[]> {
  if (!isSupabaseLive) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_session_availability');

  if (error) {
    const msg = formatSupabaseError(error);
    console.error('세션 조회 에러:', msg || error);
    throw new Error(msg || '세션 정보를 불러오지 못했습니다.');
  }

  return data || [];
}

// 추천인 존재 여부 확인 (RLS 적용 시 user_info 직접 조회 불가)
export async function verifyReferrerExists(phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_referrer_exists', {
    p_phone: phone,
  });
  if (error) return false;
  return data === true || (Array.isArray(data) && data[0] === true);
}

// 기존 회원 패스워드 검증 (서버 API에서 bcrypt 처리)
export async function verifyUserPassword(userId: string, password: string): Promise<{ id: string; credits: number } | null> {
  try {
    const res = await fetch('/api/login/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, password }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return { id: data.id, credits: data.credits ?? 0 };
  } catch {
    return null;
  }
}

// 유저 크레딧 조회
export async function getUserCredits(phone: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_credits', { p_phone: phone });

  if (error) {
    console.error('크레딧 조회 에러:', error);
    return 0;
  }

  return data || 0;
}
