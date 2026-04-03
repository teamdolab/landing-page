import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { playerCoreKey } from '@/lib/game-0b-types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const fromPlayer = body?.from_player as number | undefined;
    const toPlayer = body?.to_player as number | undefined;
    const amount = body?.amount as number | undefined;

    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }
    if (!fromPlayer || !toPlayer || !amount || amount < 1) {
      return NextResponse.json({ error: 'from_player, to_player, amount(>=1) 필수' }, { status: 400 });
    }
    if (fromPlayer === toPlayer) {
      return NextResponse.json({ error: '같은 플레이어끼리 교환 불가' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: game, error: gErr } = await supabase
      .from('game_0b')
      .select('*')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (gErr || !game) {
      return NextResponse.json({ error: '게임 없음' }, { status: 404 });
    }

    if (game.phase !== 'day') {
      return NextResponse.json({ error: '코어 교환은 낮에만 가능합니다.' }, { status: 400 });
    }

    const fromKey = playerCoreKey(fromPlayer);
    const toKey = playerCoreKey(toPlayer);
    const fromCore = (game as Record<string, unknown>)[fromKey] as number;
    const toCore = (game as Record<string, unknown>)[toKey] as number;

    if (amount > 3) {
      return NextResponse.json({ error: '1회 최대 3개까지 보낼 수 있습니다.' }, { status: 400 });
    }

    const existingLog = Array.isArray(game.public_transfer_log) ? game.public_transfer_log as number[] : [];
    if (existingLog.includes(fromPlayer)) {
      return NextResponse.json({ error: `${fromPlayer}번 플레이어는 이번 라운드에 이미 코어를 보냈습니다.` }, { status: 400 });
    }

    if (fromCore < amount) {
      return NextResponse.json({ error: `${fromPlayer}번 플레이어의 코어가 부족합니다. (보유: ${fromCore})` }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      [fromKey]: fromCore - amount,
      [toKey]: toCore + amount,
      last_public_transfer_from: fromPlayer,
      last_public_transfer_at: new Date().toISOString(),
      public_transfer_log: [...existingLog, fromPlayer],
    };

    const { error: uErr } = await supabase
      .from('game_0b')
      .update(update)
      .eq('game_id', game.game_id);

    if (uErr) {
      console.error('transfer update:', uErr);
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    await supabase.from('game_0b_event').insert({
      game_id: game.game_id,
      seq: 0,
      event_type: 'core_transfer',
      source: 'host',
      actor_player_number: fromPlayer,
      event_data: { from_player: fromPlayer, to_player: toPlayer, amount },
    });

    return NextResponse.json({ success: true, from_core: fromCore - amount, to_core: toCore + amount });
  } catch (e) {
    console.error('transfer:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
