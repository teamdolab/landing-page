import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, player_count } = body;

    if (!session_id || !player_count) {
      return NextResponse.json(
        { error: 'session_id, player_count 필수' },
        { status: 400 }
      );
    }

    const count = Number(player_count);
    if (count < 8 || count > 12) {
      return NextResponse.json(
        { error: 'player_count는 8~12 사이여야 합니다' },
        { status: 400 }
      );
    }

    const { data: gameId, error } = await supabase.rpc('initialize_poker_game', {
      p_session_id: session_id,
      p_player_count: count,
    });

    if (error) {
      console.error('게임 초기화 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 생성된 게임 정보 조회
    const { data: game, error: fetchError } = await supabase
      .from('game_0a')
      .select('*')
      .eq('game_id', gameId)
      .single();

    if (fetchError) {
      return NextResponse.json({ game_id: gameId });
    }

    return NextResponse.json(game);
  } catch (err) {
    console.error('게임 생성 오류:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
