import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;

    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: game } = await supabase
      .from('game_0b')
      .select('game_id')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (!game) {
      return NextResponse.json({ error: '게임 없음' }, { status: 404 });
    }

    // 1. game_participants active 행 정리 (이력 보존, status만 변경)
    await supabase
      .from('game_participants')
      .update({ status: 'completed' })
      .eq('game_id', game.game_id)
      .eq('status', 'active');

    // 2. game_0b_event → game_0b 순서로 삭제 (기존 로직 유지)
    await supabase
      .from('game_0b_event')
      .delete()
      .eq('game_id', game.game_id);

    await supabase
      .from('game_0b')
      .delete()
      .eq('game_id', game.game_id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('game_0b reset:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
