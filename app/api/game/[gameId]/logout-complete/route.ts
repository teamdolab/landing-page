import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCreditReward } from '@/lib/credit-reward';
import { playerNumbersToUserIds } from '@/lib/session-result';
import {
  claimCredit,
  settleSession,
  type PlayerSettlement,
  type SettlementResult,
} from '@/lib/settlement';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RankedPlayer = { player_number: number; total_score: number };

/** 포커 순위 계산 (logout-lookup 미리보기와 동일 규칙) */
function pokerRank(
  playerNumber: number,
  ranked: RankedPlayer[],
  finalWinners: number[] | null,
): number {
  const winners =
    finalWinners && finalWinners.length > 0
      ? finalWinners
      : ranked.slice(0, 1).map((p) => p.player_number);
  if (winners.includes(playerNumber)) {
    return winners.indexOf(playerNumber) + 1;
  }
  const rest = ranked.filter((p) => !winners.includes(p.player_number));
  const idx = rest.findIndex((p) => p.player_number === playerNumber);
  return idx >= 0 ? winners.length + idx + 1 : 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const { nfc_id: nfcId } = body;

    if (!gameId || !nfcId) {
      return NextResponse.json(
        { error: 'gameId, nfc_id 필수' },
        { status: 400 }
      );
    }

    // NFC 카드 번호를 읽어 어떤 플레이어인지 확인합니다.
    const krToEn: Record<string, string> = { 'ㅊ': 'c', 'ㅁ': 'a', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅠ': 'b' };
    let raw = String(nfcId);
    Object.entries(krToEn).forEach(([k, v]) => { raw = raw.replace(new RegExp(k, 'g'), v); });
    const nfcIdClean = raw.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
    if (!nfcIdClean || nfcIdClean.length < 7) {
      return NextResponse.json({ error: '유효하지 않은 NFC ID' }, { status: 400 });
    }

    const { data: card } = await supabase
      .from('player_cards')
      .select('player_number')
      .eq('nfc_id', nfcIdClean)
      .single();
    if (!card) return NextResponse.json({ error: '등록되지 않은 카드' }, { status: 400 });

    const playerNumber = card.player_number as number;

    // 이 게임에 아직 퇴장 처리되지 않은(active) 참가자인지 확인합니다.
    const { data: participant } = await supabase
      .from('game_participants')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('player_number', playerNumber)
      .eq('status', 'active')
      .single();
    if (!participant) return NextResponse.json({ error: '등록된 플레이어가 아님' }, { status: 400 });

    const { data: user } = await supabase
      .from('user_info')
      .select('credits')
      .eq('id', participant.user_id)
      .single();
    if (!user) return NextResponse.json({ error: '회원 없음' }, { status: 404 });

    const { data: game } = await supabase
      .from('game_0a')
      .select('session_id, player_count, players, final_winners, created_at')
      .eq('game_id', gameId)
      .single();
    if (!game) return NextResponse.json({ error: '게임 없음' }, { status: 404 });

    const sessionId = (game.session_id as string)?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: '세션 ID 없음' }, { status: 400 });
    }

    const players = (game.players || []) as RankedPlayer[];
    const playerCount = Math.min((game.player_count as number) || 8, 12);
    const ranked = [...players].sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.player_number - b.player_number;
    });
    const finalWinners = (game.final_winners as number[] | null) ?? null;
    const creditMap = getCreditReward(playerCount, ranked, finalWinners);

    // 첫 퇴장 시에만: 포커 규칙으로 전원 크레딧을 계산해 회차 정산 명세를 한 번 만듭니다.
    const { data: existingReceipt } = await supabase
      .from('session_player_results')
      .select('id')
      .eq('session_id', sessionId)
      .limit(1)
      .maybeSingle();

    if (!existingReceipt) {
      const { data: allParticipants } = await supabase
        .from('game_participants')
        .select('user_id, player_number')
        .eq('game_id', gameId);

      const userIdByPlayer = new Map<number, string>();
      for (const row of allParticipants ?? []) {
        if (row.user_id) userIdByPlayer.set(row.player_number as number, row.user_id as string);
      }

      const userIds = [...new Set(userIdByPlayer.values())];
      const creditsByUserId = new Map<string, number>();
      if (userIds.length > 0) {
        const { data: creditRows } = await supabase
          .from('user_info')
          .select('id, credits')
          .in('id', userIds);
        for (const row of creditRows ?? []) {
          creditsByUserId.set(row.id as string, (row.credits as number) ?? 0);
        }
      }

      const settlementPlayers: PlayerSettlement[] = ranked.map((p) => {
        const creditDelta = creditMap.get(p.player_number) ?? 0;
        const uid = userIdByPlayer.get(p.player_number) ?? null;
        const creditBefore = uid ? (creditsByUserId.get(uid) ?? 0) : 0;
        return {
          user_id: uid,
          player_number: p.player_number,
          credit_before: creditBefore,
          credit_delta: creditDelta,
          credit_after: creditBefore + creditDelta,
          rank: pokerRank(p.player_number, ranked, finalWinners) || null,
          raw: { total_score: p.total_score },
        };
      });

      const winnerNums: number[] =
        finalWinners ?? (ranked.length > 0 ? [ranked[0].player_number] : []);
      const winnerUserIds = await playerNumbersToUserIds(gameId, winnerNums);
      const topScore = ranked[0]?.total_score ?? 0;
      const endedAt = new Date().toISOString();

      const payload: SettlementResult = {
        session_id: sessionId,
        game_type: 'game_0a',
        started_at: (game.created_at as string) ?? null,
        ended_at: endedAt,
        player_count: playerCount,
        winner_user_ids: winnerUserIds,
        result_summary: {
          top_score: topScore,
          final_ranking: ranked.map((p) => ({
            player_number: p.player_number,
            total_score: p.total_score,
          })),
        },
        players: settlementPlayers,
      };

      await settleSession(payload);
    }

    // 본인 영수증의 pending 크레딧을 실제 계정에 한 번만 반영합니다.
    const claimOutcome = await claimCredit(sessionId, playerNumber);

    let creditGain = creditMap.get(playerNumber) ?? 0;
    let creditsAfter = (user.credits as number) ?? 0;

    if (claimOutcome.claimed && claimOutcome.creditsAfter != null) {
      creditsAfter = claimOutcome.creditsAfter;
      creditGain = (claimOutcome.creditsAfter ?? 0) - (claimOutcome.creditsBefore ?? 0);
    } else if (claimOutcome.alreadyClaimed) {
      creditGain = 0;
      const { data: refreshed } = await supabase
        .from('user_info')
        .select('credits')
        .eq('id', participant.user_id)
        .single();
      creditsAfter = (refreshed?.credits as number) ?? creditsAfter;
    } else if (!claimOutcome.claimed) {
      return NextResponse.json(
        { error: '정산 영수증을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 404 }
      );
    }

    // 퇴장 처리: 같은 카드로 다시 찍어도 active가 아니면 위에서 걸러집니다.
    await supabase
      .from('game_participants')
      .update({ status: 'completed' })
      .eq('game_id', gameId)
      .eq('player_number', playerNumber)
      .eq('status', 'active');

    return NextResponse.json({
      settlement: {
        success: true,
        creditGain,
        creditsAfter,
      },
    });
  } catch (err) {
    console.error('logout-complete 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
