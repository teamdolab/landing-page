import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { user_id: userId, nfc_id: nfcId } = body;

    if (!gameId || !userId || !nfcId) {
      return NextResponse.json(
        { error: 'gameId, user_id, nfc_id 필수' },
        { status: 400 }
      );
    }

    // NFC 리더기: 한영키 한글 모드 시 ㅊ→c, ㅁ→a 등 변환 후 hex만 추출
    const krToEn: Record<string, string> = { 'ㅊ': 'c', 'ㅁ': 'a', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅠ': 'b' };
    let raw = String(nfcId);
    Object.entries(krToEn).forEach(([k, v]) => { raw = raw.replace(new RegExp(k, 'g'), v); });
    const nfcIdClean = raw.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
    if (!nfcIdClean || nfcIdClean.length < 7) {
      return NextResponse.json(
        { error: '유효하지 않은 NFC ID' },
        { status: 400 }
      );
    }

    // 1. NFC ID → player_number 조회
    const { data: card, error: cardError } = await supabase
      .from('player_cards')
      .select('player_number')
      .eq('nfc_id', nfcIdClean)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: '등록되지 않은 플레이어 카드입니다.' },
        { status: 400 }
      );
    }

    const playerNumber = card.player_number as number;

    // 2. 게임 존재 및 player_count 확인
    const { data: game, error: gameError } = await supabase
      .from('game_0a')
      .select('game_id, player_count')
      .eq('game_id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: '게임을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const playerCount = game.player_count as number;
    if (playerNumber > playerCount) {
      return NextResponse.json(
        { error: `이 게임은 ${playerCount}명까지 참가 가능합니다. (카드: PLAYER ${playerNumber})` },
        { status: 400 }
      );
    }

    // 3. 해당 슬롯이 이미 사용 중인지 확인 (active만)
    const { data: existing } = await supabase
      .from('game_participants')
      .select('id')
      .eq('game_id', gameId)
      .eq('player_number', playerNumber)
      .eq('status', 'active')
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이 플레이어 카드는 이미 등록되었습니다.' },
        { status: 409 }
      );
    }

    // 4. 해당 유저가 이미 이 게임에 등록했는지 확인 (active만)
    const { data: userExisting } = await supabase
      .from('game_participants')
      .select('id')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (userExisting) {
      return NextResponse.json(
        { error: '이미 이 게임에 등록되어 있습니다.' },
        { status: 409 }
      );
    }

    // 5. 등록 (status='active'로 이력 트래킹용)
    const { error: insertError } = await supabase.from('game_participants').insert({
      game_id: gameId,
      player_number: playerNumber,
      user_id: userId,
      status: 'active',
    });

    if (insertError) {
      console.error('game_participants insert 에러:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      player_number: playerNumber,
    });
  } catch (err) {
    console.error('register-player 오류:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
