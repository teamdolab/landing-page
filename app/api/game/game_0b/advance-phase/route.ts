import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { clampShipHull, NATURAL_DECAY, playerCoreKey, playerRoleKey, type Game0bRow } from '@/lib/game-0b-types';
import { resolveNightActions, type NightEvent } from '@/lib/game-0b-resolve';
import {
  preliminaryGaugeLine,
  validateLifeboatSeats,
  finalOutcomeInfoText,
} from '@/lib/game-0b-result';
import { insertSessionResult, playerNumbersToUserIds } from '@/lib/session-result';
import { runGame0bSettleSession } from '@/lib/game-0b-settlement-run';

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
          // 코어 +1은 밤 시작(start_night) 시에만 지급. 밤 종료 → 낮 전환에서는 지급하지 않음.
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

      // 1. 자연 부식 먼저 적용 (낮→밤 전환 시)
      // 인원별 자연부식 (game-0b-types.ts NATURAL_DECAY 참조)
      update.ship_hull = clampShipHull(game.ship_hull as number) - (NATURAL_DECAY[pc] ?? 20);

      // 2. 코어 +1 지급
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

      // ── hull <= 50 → 외계인 승 → session_results INSERT (비차단) ──
      if (clampShipHull(game.ship_hull as number) <= 50) {
        (async () => {
          try {
            const hull = clampShipHull(game.ship_hull as number);
            const pc = game.player_count as number;
            const alienNums: number[] = [];
            const gameMap = game as Record<string, unknown>;
            for (let i = 1; i <= pc; i++) {
              if (gameMap[playerRoleKey(i)] === '외계인') alienNums.push(i);
            }
            const winnerUserIds = await playerNumbersToUserIds(game.game_id as string, alienNums);
            await insertSessionResult({
              sessionId: (game.session_id as string) ?? null,
              gameType: 'game_0b',
              startedAt: (game.created_at as string) ?? null,
              endedAt: new Date().toISOString(),
              playerCount: pc,
              winnerUserIds,
              resultSummary: {
                ship_hull_final: hull,
                winning_faction: '외계인',
                alien_player_numbers: alienNums,
              },
            });
            await runGame0bSettleSession({
              game: game as Game0bRow,
              winnerUserIds,
              winnerPlayerNumbers: alienNums,
              resultSummary: {
                ship_hull_final: hull,
                winning_faction: '외계인',
                alien_player_numbers: alienNums,
              },
            });
          } catch (e) {
            console.error('advance-phase reveal_gauge: session_results 저장 실패 (무시)', e);
          }
        })();
      }
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
      if (clampShipHull(game.ship_hull as number) <= 50) {
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

      // ── 탑승 확정 → session_results INSERT (비차단) ──
      (async () => {
        try {
          const hull = clampShipHull(game.ship_hull as number);
          const winningFaction = game.revolutionary_player_number != null ? '반군' : '생존자';
          const winnerUserIds = await playerNumbersToUserIds(game.game_id as string, seatNums);
          await insertSessionResult({
            sessionId: (game.session_id as string) ?? null,
            gameType: 'game_0b',
            startedAt: (game.created_at as string) ?? null,
            endedAt: new Date().toISOString(),
            playerCount: game.player_count as number,
            winnerUserIds,
            resultSummary: {
              ship_hull_final: hull,
              winning_faction: winningFaction,
              lifeboat_seats: seatNums,
              lifeboat_count: seatNums.length,
            },
          });
          const gameWithSeats = { ...row } as Game0bRow;
          for (let i = 0; i < 5; i++) {
            (gameWithSeats as unknown as Record<string, number | null>)[`lifeboat_seat_${i + 1}`] = seatNums[i] ?? null;
          }
          await runGame0bSettleSession({
            game: gameWithSeats,
            winnerUserIds,
            winnerPlayerNumbers: seatNums,
            resultSummary: {
              ship_hull_final: hull,
              winning_faction: winningFaction,
              lifeboat_seats: seatNums,
              lifeboat_count: seatNums.length,
            },
          });
        } catch (e) {
          console.error('advance-phase confirm_lifeboat: session_results 저장 실패 (무시)', e);
        }
      })();
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
