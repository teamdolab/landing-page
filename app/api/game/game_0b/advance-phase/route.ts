import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { playerCoreKey } from '@/lib/game-0b-types';
import { resolveNightActions, type NightEvent } from '@/lib/game-0b-resolve';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const action = body?.action as string | undefined;

    if (!sessionId?.trim() || !action) {
      return NextResponse.json({ error: 'session_id, action 필수' }, { status: 400 });
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

    const update: Record<string, unknown> = {};

    if (action === 'start_round') {
      // setup→day 또는 night→next day
      if (game.phase !== 'setup' && game.phase !== 'night') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 start_round 불가` }, { status: 400 });
      }

      if (game.phase === 'night') {
        // 밤 액션 일괄 처리
        const { data: nightEvents } = await supabase
          .from('game_0b_event')
          .select('*')
          .eq('game_id', game.game_id)
          .eq('event_type', 'night_action')
          .order('created_at', { ascending: true });

        const currentRoundEvents = (nightEvents ?? []).filter(
          (ev: Record<string, unknown>) =>
            (ev.event_data as Record<string, unknown>)?.round === game.current_round,
        ) as unknown as NightEvent[];

        if (currentRoundEvents.length > 0) {
          const result = resolveNightActions(game as Record<string, unknown>, currentRoundEvents);
          Object.assign(update, result.updates);
          update.detected_actions = result.detectedActions;

          await supabase.from('game_0b_event').insert({
            game_id: game.game_id,
            seq: 0,
            event_type: 'night_resolve',
            source: 'system',
            event_data: { log: result.log, round: game.current_round },
          });
        }

        // 라운드 증가
        update.current_round = game.current_round + 1;

        // 자연 부식 (라운드 2 이상)
        const currentHull = (update.ship_hull as number | undefined) ?? (game.ship_hull as number);
        update.ship_hull = currentHull - 20;
      } else {
        // setup → day: 1라운드 시작이므로 자연 부식 없음
        update.detected_actions = [];
      }

      // 코어 지급 (밤→낮 전환 시)
      if (game.phase === 'night') {
        const pc = game.player_count as number;
        for (let i = 1; i <= pc; i++) {
          const key = playerCoreKey(i);
          const current = (update[key] as number | undefined) ?? ((game as Record<string, unknown>)[key] as number);
          update[key] = current + 1;
        }
      }

      update.phase = 'day';
      update.night_action_count = 0;
      update.last_public_transfer_from = null;

      // 5라운드 초과 시 게임 종료
      if ((update.current_round as number | undefined) != null && (update.current_round as number) > 5) {
        update.current_round = 5;
        update.phase = 'day';
        update.status = '완료';
      }
    } else if (action === 'start_night') {
      if (game.phase !== 'day') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 start_night 불가` }, { status: 400 });
      }

      update.phase = 'night';
      update.night_action_count = 0;
    } else if (action === 'finish') {
      update.status = '완료';
    } else {
      return NextResponse.json({ error: `알 수 없는 action: ${action}` }, { status: 400 });
    }

    const { error: uErr } = await supabase
      .from('game_0b')
      .update(update)
      .eq('game_id', game.game_id);

    if (uErr) {
      console.error('advance-phase update:', uErr);
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    const { data: updated } = await supabase
      .from('game_0b')
      .select('*')
      .eq('game_id', game.game_id)
      .single();

    return NextResponse.json(updated);
  } catch (e) {
    console.error('advance-phase:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
