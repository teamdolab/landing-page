import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiUpdateToDb, dbRowToApi } from '@/lib/game-transform';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!gameId) {
    return NextResponse.json({ error: 'gameId required' }, { status: 400 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { action_type, action_player_number, action_data } = body;

    // Undo용 액션 로깅 (실패해도 업데이트는 진행)
    if (action_type) {
      try {
        const { error: actionError } = await supabase.rpc('add_poker_action', {
          p_game_id: gameId,
          p_action_type: action_type,
          p_player_number: action_player_number ?? 0,
          p_action_data: action_data ?? {},
        });
        if (actionError) console.error('add_poker_action 에러:', actionError);
      } catch {
        // RPC 없음/오류 시에도 메인 업데이트는 진행
      }
    }

    const updates = apiUpdateToDb(body);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드 없음' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('game_0a')
      .update(updates)
      .eq('game_id', gameId)
      .select()
      .single();

    if (error) {
      console.error('게임 업데이트 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(dbRowToApi(data as Record<string, unknown>));
  } catch (err) {
    console.error('게임 업데이트 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
