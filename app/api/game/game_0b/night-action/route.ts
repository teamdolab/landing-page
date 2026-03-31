import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { playerCoreKey } from '@/lib/game-0b-types';

const ACTION_COSTS: Record<string, number> = {
  mine: 0,
  repair_survivor: 1,
  repair_rebel: 2,
  search: 5,
  control: 5,
  detect: 0,
  jamming: 4,
  assassinate: 10,
  plunder: 0,
  destroy: 4,
  hidden_trade: 0,
  skip: 0,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const playerNumber = body?.player_number as number | undefined;
    const actionType = body?.action_type as string | undefined;
    const targetPlayer = body?.target_player as number | undefined | null;
    const extraData = body?.extra_data as Record<string, unknown> | undefined;

    if (!sessionId?.trim() || !playerNumber || !actionType) {
      return NextResponse.json({ error: 'session_id, player_number, action_type 필수' }, { status: 400 });
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

    if (game.phase !== 'night') {
      return NextResponse.json({ error: '밤 시간에만 액션 가능합니다.' }, { status: 400 });
    }

    const coreKey = playerCoreKey(playerNumber);
    const currentCore = (game as Record<string, unknown>)[coreKey] as number;

    const cost = ACTION_COSTS[actionType] ?? 0;
    if (currentCore < cost) {
      return NextResponse.json({ error: `코어 부족 (보유: ${currentCore}, 필요: ${cost})` }, { status: 400 });
    }

    const isNonConsuming = actionType === 'detect' || actionType === 'hidden_trade';

    const eventData: Record<string, unknown> = {
      action_type: actionType,
      round: game.current_round,
      cost,
      is_non_consuming: isNonConsuming,
    };
    if (targetPlayer != null) eventData.target_player = targetPlayer;
    if (extraData) eventData.extra = extraData;

    const { data: ev, error: evErr } = await supabase
      .from('game_0b_event')
      .insert({
        game_id: game.game_id,
        seq: 0,
        event_type: 'night_action',
        source: 'testroom',
        actor_player_number: playerNumber,
        event_data: eventData,
      })
      .select('*')
      .single();

    if (evErr) {
      console.error('night-action event insert:', evErr);
      return NextResponse.json({ error: evErr.message }, { status: 500 });
    }

    const snapshotUpdate: Record<string, unknown> = {
      night_action_count: (game.night_action_count ?? 0) + 1,
    };

    if (cost > 0) {
      snapshotUpdate[coreKey] = currentCore - cost;
    }

    if (actionType === 'hidden_trade' && targetPlayer != null) {
      const amount = (extraData?.amount as number) ?? 1;
      if (currentCore >= amount) {
        snapshotUpdate[coreKey] = currentCore - amount;
        const targetCoreKey = playerCoreKey(targetPlayer);
        const targetCore = (game as Record<string, unknown>)[targetCoreKey] as number;
        snapshotUpdate[targetCoreKey] = targetCore + amount;
      }
    }

    await supabase.from('game_0b').update(snapshotUpdate).eq('game_id', game.game_id);

    return NextResponse.json({ success: true, event_id: ev.id, event_seq: ev.seq });
  } catch (e) {
    console.error('night-action:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
