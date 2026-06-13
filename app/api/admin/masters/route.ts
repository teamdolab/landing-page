import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** 마스터 테이블 3종 일괄 조회 (stores / seasons / game_types) */
export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();

  const [stores, seasons, gameTypes] = await Promise.all([
    supabase.from('stores').select('*').order('code'),
    supabase.from('seasons').select('*').order('code'),
    supabase.from('game_types').select('*').order('code'),
  ]);

  const firstError = stores.error || seasons.error || gameTypes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    stores: stores.data ?? [],
    seasons: seasons.data ?? [],
    game_types: gameTypes.data ?? [],
  });
}
