import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const KR_TO_EN: Record<string, string> = {
  'ㅊ': 'c', 'ㅁ': 'a', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅠ': 'b',
};

function cleanNfcId(raw: string): string {
  let s = String(raw);
  for (const [k, v] of Object.entries(KR_TO_EN)) {
    s = s.replaceAll(k, v);
  }
  return s.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nfcId = body?.nfc_id as string | undefined;
    const sessionId = body?.session_id as string | undefined;

    if (!nfcId?.trim()) {
      return NextResponse.json({ error: 'nfc_id 필수' }, { status: 400 });
    }
    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const cleaned = cleanNfcId(nfcId);
    if (!cleaned || cleaned.length < 7) {
      return NextResponse.json({ error: '유효하지 않은 NFC ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: card, error: cardErr } = await supabase
      .from('player_cards')
      .select('player_number')
      .eq('nfc_id', cleaned)
      .single();

    if (cardErr || !card) {
      return NextResponse.json({ error: '등록되지 않은 플레이어 카드입니다.' }, { status: 404 });
    }

    const playerNumber = card.player_number as number;

    const { data: game, error: gameErr } = await supabase
      .from('game_0b')
      .select('game_id, player_count')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (gameErr || !game) {
      return NextResponse.json({ error: '게임을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (playerNumber > (game.player_count as number)) {
      return NextResponse.json(
        { error: `이 게임은 ${game.player_count}명까지입니다. (카드: ${playerNumber}번)` },
        { status: 400 },
      );
    }

    return NextResponse.json({ player_number: playerNumber });
  } catch (e) {
    console.error('nfc-lookup:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
