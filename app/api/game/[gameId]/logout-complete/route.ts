import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCreditReward } from '@/lib/credit-reward';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const { nfc_id: nfcId, q2_score: q2Score, q3_score: q3Score } = body;

    if (!gameId || !nfcId) {
      return NextResponse.json(
        { error: 'gameId, nfc_id 필수' },
        { status: 400 }
      );
    }

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

    const { data: participant } = await supabase
      .from('game_participants')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('player_number', card.player_number)
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
      .select('player_count, players, final_winners')
      .eq('game_id', gameId)
      .single();
    if (!game) return NextResponse.json({ error: '게임 없음' }, { status: 404 });

    const players = (game.players || []) as Array<{ player_number: number; total_score: number }>;
    const playerCount = Math.min((game.player_count as number) || 8, 12);
    const ranked = [...players].sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.player_number - b.player_number;
    });
    const finalWinners = (game.final_winners as number[] | null) ?? null;
    const creditMap = getCreditReward(playerCount, ranked, finalWinners);
    const creditGain = creditMap.get(card.player_number as number) ?? 0;
    const creditsBefore = (user.credits as number) ?? 0;
    const creditsAfter = creditsBefore + creditGain;

    await supabase
      .from('user_info')
      .update({ credits: creditsAfter })
      .eq('id', participant.user_id);

    // status='completed'로 업데이트 + 간략 피드백 저장 (플레이 스타일 분석용 이력 보존)
    const updatePayload: Record<string, unknown> = { status: 'completed' };
    if (typeof q2Score === 'number' && q2Score >= 0 && q2Score <= 10) {
      updatePayload.feedback_satisfaction = q2Score;
    }
    if (typeof q3Score === 'number' && q3Score >= 0 && q3Score <= 10) {
      updatePayload.feedback_recommendation = q3Score;
    }
    await supabase
      .from('game_participants')
      .update(updatePayload)
      .eq('game_id', gameId)
      .eq('player_number', card.player_number)
      .eq('status', 'active');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('logout-complete 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
