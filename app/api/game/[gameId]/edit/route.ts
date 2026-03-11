import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dbRowToApi } from '@/lib/game-transform';
import { applyEditOp, type EditOp } from '@/lib/edit-smart';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!gameId) {
    return NextResponse.json({ error: 'gameId required' }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { op?: EditOp; ops?: EditOp[] };
    const ops: EditOp[] = body.ops ?? (body.op ? [body.op] : []);

    if (ops.length === 0) {
      return NextResponse.json({ error: 'op 또는 ops 필요' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabase
      .from('game_0a')
      .select('*')
      .eq('game_id', gameId)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: '게임을 찾을 수 없습니다' }, { status: 404 });
    }

    const state = {
      player_count: row.player_count ?? 8,
      current_round: row.current_round ?? 1,
      current_step: row.current_step ?? 0,
      current_player: row.current_player,
      first_player_number: row.first_player_number,
      declaration_results: row.declaration_results ?? {},
      candidate_revealed_cards: row.candidate_revealed_cards ?? {},
      votes: row.votes ?? {},
      round_winners: row.round_winners ?? {},
      round_scores: row.round_scores ?? {},
      info_text: row.info_text,
    };

    let updates: Record<string, unknown> = {};
    let currentState = { ...state };

    for (const op of ops) {
      const delta = applyEditOp(currentState, op);
      updates = { ...updates, ...delta };
      currentState = { ...currentState, ...delta };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(dbRowToApi(row as Record<string, unknown>));
    }

    const { data: updated, error: updateError } = await supabase
      .from('game_0a')
      .update(updates)
      .eq('game_id', gameId)
      .select()
      .single();

    if (updateError) {
      console.error('Edit 업데이트 에러:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(dbRowToApi(updated as Record<string, unknown>));
  } catch (err) {
    console.error('Edit 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
