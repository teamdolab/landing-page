import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function cleanNfcId(raw: string): string {
  const KR_TO_EN: Record<string, string> = {
    'ㅊ': 'c', 'ㅁ': 'a', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅠ': 'b',
  };
  let s = String(raw);
  for (const [k, v] of Object.entries(KR_TO_EN)) s = s.replaceAll(k, v);
  return s.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      game_id: gameId,
      session_id: sessionId,
      nfc_id: nfcId,
      nps,
      return_intent: returnIntent,
    } = body;

    if (!gameId) {
      return NextResponse.json({ error: 'game_id 필수' }, { status: 400 });
    }
    if (nps !== undefined && (typeof nps !== 'number' || nps < 0 || nps > 10)) {
      return NextResponse.json({ error: 'nps는 0~10 정수' }, { status: 400 });
    }
    if (returnIntent !== undefined && !['yes', 'maybe', 'no'].includes(returnIntent)) {
      return NextResponse.json({ error: 'return_intent는 yes/maybe/no' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // nfc_id → player_number → user_id 조회 (선택적)
    let userId: string | null = null;
    if (nfcId) {
      const cleaned = cleanNfcId(nfcId);
      if (cleaned.length >= 7) {
        const { data: card } = await supabase
          .from('player_cards')
          .select('player_number')
          .eq('nfc_id', cleaned)
          .maybeSingle();

        if (card) {
          const { data: participant } = await supabase
            .from('game_participants')
            .select('user_id')
            .eq('game_id', gameId)
            .eq('player_number', card.player_number)
            .in('status', ['active', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (participant) userId = participant.user_id as string;
        }
      }
    }

    const { error: insertError } = await supabase.from('feedback_quick').insert({
      game_id: gameId,
      session_id: sessionId ?? null,
      user_id: userId,
      nps: typeof nps === 'number' ? nps : null,
      return_intent: returnIntent ?? null,
    });

    if (insertError) {
      console.error('feedback_quick insert:', insertError);
      return NextResponse.json({ error: '피드백 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('feedback/quick 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
