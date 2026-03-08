import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const body = await req.json();
    const {
      current_step,
      current_round,
      info_text,
      timer_seconds,
      timer_active,
      timer_end,
      current_player,
      community_cards,
      players,
      votes,
      round_winners,
      final_winners,
      status,
    } = body;

    const updates: Record<string, unknown> = {};
    if (current_step !== undefined) updates.current_step = current_step;
    if (current_round !== undefined) updates.current_round = current_round;
    if (info_text !== undefined) updates.info_text = info_text;
    if (timer_seconds !== undefined) updates.timer_seconds = timer_seconds;
    if (timer_active !== undefined) updates.timer_active = timer_active;
    if (timer_end !== undefined) updates.timer_end = timer_end;
    if (current_player !== undefined) updates.current_player = current_player;
    if (community_cards !== undefined) updates.community_cards = community_cards;
    if (players !== undefined) updates.players = players;
    if (votes !== undefined) updates.votes = votes;
    if (round_winners !== undefined) updates.round_winners = round_winners;
    if (final_winners !== undefined) updates.final_winners = final_winners;
    if (status !== undefined) updates.status = status;

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

    return NextResponse.json(data);
  } catch (err) {
    console.error('게임 업데이트 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
