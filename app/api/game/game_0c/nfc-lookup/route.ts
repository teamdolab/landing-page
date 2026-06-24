import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isGame0c, resolveGameKind } from '@/lib/session-game-kind';

const KR_TO_EN: Record<string, string> = {
  'ㅊ': 'c', 'ㅁ': 'a', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅠ': 'b',
};

function cleanCardUid(raw: string): string {
  let s = String(raw);
  for (const [k, v] of Object.entries(KR_TO_EN)) {
    s = s.replaceAll(k, v);
  }
  return s.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cardUid = (body?.card_uid ?? body?.nfc_id) as string | undefined;
    const sessionId = body?.session_id as string | undefined;

    if (!cardUid?.trim()) {
      return NextResponse.json({ error: 'card_uid 필수' }, { status: 400 });
    }
    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const cleaned = cleanCardUid(cardUid);
    if (!cleaned || cleaned.length < 7) {
      return NextResponse.json({ error: '유효하지 않은 카드 UID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let { data: card } = await supabase
      .from('player_cards')
      .select('player_number')
      .eq('nfc_id', cleaned)
      .maybeSingle();

    if (!card) {
      const { data: allCards } = await supabase
        .from('player_cards')
        .select('nfc_id, player_number');

      if (allCards) {
        const match = allCards.find(
          (c) => cleaned.includes(c.nfc_id as string) || (c.nfc_id as string).includes(cleaned),
        );
        if (match) card = { player_number: match.player_number };
      }
    }

    if (!card) {
      return NextResponse.json({ error: '등록되지 않은 카드입니다.' }, { status: 404 });
    }

    const playerNumber = card.player_number as number;

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('game_kind')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (sessionErr || !session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!isGame0c(resolveGameKind(session))) {
      return NextResponse.json({ error: 'game_0c 세션이 아닙니다.' }, { status: 400 });
    }

    const { data: snapshot, error: snapErr } = await supabase
      .from('game_0c_snapshot')
      .select('players')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (snapErr || !snapshot) {
      return NextResponse.json({ error: '게임이 초기화되지 않았습니다.' }, { status: 404 });
    }

    const players = (snapshot.players ?? []) as { num: number }[];
    if (!players.some((p) => p.num === playerNumber)) {
      return NextResponse.json(
        { error: '이 세션에 등록되지 않은 플레이어 카드입니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ player_number: playerNumber });
  } catch (e) {
    console.error('game_0c nfc-lookup:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
