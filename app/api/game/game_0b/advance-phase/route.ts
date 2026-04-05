import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { playerCoreKey, type Game0bRow } from '@/lib/game-0b-types';
import { resolveNightActions, type NightEvent } from '@/lib/game-0b-resolve';
import {
  preliminaryGaugeLine,
  validateLifeboatSeats,
  finalOutcomeInfoText,
} from '@/lib/game-0b-result';

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

    if (action === 'distribute_roles') {
      if (game.phase !== 'setup') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 distribute_roles 불가` }, { status: 400 });
      }
      update.phase = 'role_reveal';
    } else if (action === 'start_round') {
      if (game.phase !== 'role_reveal' && game.phase !== 'night') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 start_round 불가` }, { status: 400 });
      }

      if (game.phase === 'night') {
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

        const nextRound = game.current_round + 1;
        update.current_round = nextRound;

        const currentHull = (update.ship_hull as number | undefined) ?? (game.ship_hull as number);
        update.ship_hull = currentHull - 20;

        if (nextRound > 5) {
          update.current_round = 5;
          update.phase = 'result_reveal';
          update.status = '완료';
          update.phase_deadline_at = null;
          update.night_action_count = 0;
          update.last_public_transfer_from = null;
          update.public_transfer_log = [];
          update.result_locked = false;
          update.info_text = null;
          for (let k = 1; k <= 5; k++) {
            update[`lifeboat_seat_${k}`] = null;
          }
        } else {
          const pc = game.player_count as number;
          for (let i = 1; i <= pc; i++) {
            const key = playerCoreKey(i);
            const current =
              (update[key] as number | undefined) ?? ((game as Record<string, unknown>)[key] as number);
            update[key] = current + 1;
          }

          update.phase = 'day';
          update.night_action_count = 0;
          update.last_public_transfer_from = null;
          update.public_transfer_log = [];
          update.phase_deadline_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        }
      } else {
        update.current_round = 1;
        update.detected_actions = [];
        update.phase = 'day';
        update.night_action_count = 0;
        update.last_public_transfer_from = null;
        update.public_transfer_log = [];
        update.phase_deadline_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      }
    } else if (action === 'start_night') {
      if (game.phase !== 'day') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 start_night 불가` }, { status: 400 });
      }

      const pc = game.player_count as number;
      update.phase = 'night';
      update.night_action_count = 0;
      update.phase_deadline_at = new Date(Date.now() + pc * 60 * 1000).toISOString();

      for (let i = 1; i <= pc; i++) {
        const key = playerCoreKey(i);
        const current = (game as Record<string, unknown>)[key] as number;
        update[key] = current + 1;
      }
    } else if (action === 'reveal_gauge') {
      if (game.phase !== 'result_reveal') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 reveal_gauge 불가` }, { status: 400 });
      }
      if (game.result_locked) {
        return NextResponse.json({ error: '이미 게이지를 공개했습니다' }, { status: 400 });
      }
      update.result_locked = true;
      update.info_text = preliminaryGaugeLine(game as Game0bRow);
    } else if (action === 'confirm_lifeboat') {
      const seats = body?.seats as unknown;
      if (!Array.isArray(seats) || !seats.every((x) => typeof x === 'number')) {
        return NextResponse.json({ error: 'seats: 숫자 배열 필수' }, { status: 400 });
      }
      const seatNums = seats.map((x) => Math.trunc(x as number));
      if (game.phase !== 'result_reveal') {
        return NextResponse.json({ error: `현재 phase(${game.phase})에서 confirm_lifeboat 불가` }, { status: 400 });
      }
      if (!game.result_locked) {
        return NextResponse.json({ error: '먼저 게이지 공개를 진행하세요' }, { status: 400 });
      }
      if ((game.ship_hull as number) <= 50) {
        return NextResponse.json({ error: '수송선이 안전 구간이 아니면 탑승 확정이 필요 없습니다' }, { status: 400 });
      }
      if (game.lifeboat_seat_1 != null) {
        return NextResponse.json({ error: '이미 탑승이 확정되었습니다' }, { status: 400 });
      }

      const row = game as Game0bRow;
      const err = validateLifeboatSeats(row, seatNums);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }

      for (let i = 0; i < 5; i++) {
        update[`lifeboat_seat_${i + 1}`] = seatNums[i] ?? null;
      }
      update.info_text = finalOutcomeInfoText(row, seatNums);
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
