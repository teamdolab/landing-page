import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dbRowToApi } from '@/lib/game-transform';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildInitialRoundScores(count: number): Record<string, number[]> {
  const r: Record<string, number[]> = {};
  for (let i = 1; i <= count; i++) r[String(i)] = [0, 0, 0, 0];
  return r;
}

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

    // 선 정하기 단계로 설정 + 새 칼럼 초기화
    const { error: updateError } = await supabase
      .from('game_0a')
      .update({
        current_step: 1,
        info_text: '선 정하기',
        status: '진행중',
        first_player_number: null,
        dealing_completed: false,
        declaration_results: {},
        candidate_revealed_cards: {},
        round_scores: buildInitialRoundScores(count),
      })
      .eq('game_id', gameId);

    if (updateError) {
      console.error('게임 초기 설정 에러:', updateError);
    }

    const { data: game, error: fetchError } = await supabase
      .from('game_0a')
      .select('*')
      .eq('game_id', gameId)
      .single();

    if (fetchError) {
      return NextResponse.json({ game_id: gameId });
    }

    return NextResponse.json(dbRowToApi(game as Record<string, unknown>));
  } catch (err) {
    console.error('게임 생성 오류:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
