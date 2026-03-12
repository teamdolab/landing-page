import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dbRowToApi } from '@/lib/game-transform';

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

  let body: { target_round?: number; target_step?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const targetRound = parseInt(String(body.target_round ?? 1), 10);
  const targetStep = parseInt(String(body.target_step ?? 0), 10);

  if (targetRound < 1 || targetRound > 4 || targetStep < 0 || targetStep > 10) {
    return NextResponse.json(
      { error: 'target_round(1~4), target_step(0~10) 필요' },
      { status: 400 }
    );
  }

  try {
    const { data: gameRow, error } = await supabase.rpc('restore_to_step', {
      p_game_id: gameId,
      p_target_round: targetRound,
      p_target_step: targetStep,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!gameRow) {
      return NextResponse.json({ error: '게임 없음' }, { status: 404 });
    }

    const game = dbRowToApi(gameRow as Record<string, unknown>);
    return NextResponse.json({ success: true, game });
  } catch (err) {
    console.error('go-to-step 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
