import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 타입 정의
export type User = {
  id: string;
  phone: string;
  phone_pin: string;
  nickname: string;
  password_hash: string;
  created_at: string;
};

export type PlayerCard = {
  id: string;
  nfc_uid: string;
  user_id: string;
  linked_at: string;
};
