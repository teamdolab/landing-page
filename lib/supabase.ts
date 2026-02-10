import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// 유저 존재 여부 확인
export async function checkUserExists(name: string, phone: string): Promise<UserExistsResult> {
  const { data, error } = await supabase
    .from('user_info')
    .select('id, nickname, credits')
    .eq('name', name)
    .eq('phone', phone)
    .single();

  if (error || !data) {
    return { user_exists: false, user_id: null, nickname: null, credits: 0 };
  }

  return {
    user_exists: true,
    user_id: data.id,
    nickname: data.nickname,
    credits: data.credits,
  };
}

// 실시간 예약 현황 조회
export async function getSessionAvailability(): Promise<SessionAvailability[]> {
  const { data, error } = await supabase.rpc('get_session_availability');

  if (error) {
    console.error('세션 조회 에러:', error);
    return [];
  }

  return data || [];
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
