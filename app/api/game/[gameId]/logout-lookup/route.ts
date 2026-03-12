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
    const { nfc_id: nfcId } = body;

    if (!gameId || !nfcId) {
      return NextResponse.json(
        { error: 'gameId, nfc_id 필수' },
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

    // 2. game_participants에서 해당 게임+플레이어의 user_id 조회 (active만)
    const { data: participant, error: partError } = await supabase
      .from('game_participants')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('player_number', playerNumber)
      .eq('status', 'active')
      .single();

    if (partError || !participant) {
      return NextResponse.json(
        { error: '이 게임에 등록된 플레이어 카드가 아닙니다.' },
        { status: 400 }
      );
    }

    const userId = participant.user_id as string;

    // 3. user_info 조회 (닉네임, 크레딧)
    const { data: user, error: userError } = await supabase
      .from('user_info')
      .select('nickname, credits')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: '회원 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 4. game_0a 조회 (게임명, 플레이어 점수/순위)
    const { data: game, error: gameError } = await supabase
      .from('game_0a')
      .select('session_id, player_count, players, final_winners')
      .eq('game_id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: '게임 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 5. sessions에서 게임명 조회
    const { data: session } = await supabase
      .from('sessions')
      .select('game_name')
      .eq('session_id', game.session_id)
      .single();

    const gameName = session?.game_name ?? game.session_id;

    // 6. 순위 및 크레딧 계산
    const players = (game.players || []) as Array<{ player_number: number; total_score: number }>;
    const playerCount = Math.min((game.player_count as number) || 8, 12);
    const ranked = [...players].sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.player_number - b.player_number;
    });
    const finalWinners = (game.final_winners as number[] | null) ?? null;
    const creditMap = getCreditReward(playerCount, ranked, finalWinners);
    const creditGain = creditMap.get(playerNumber) ?? 0;

    // 순위 (final_winners 반영)
    const winners = finalWinners?.length ? finalWinners : ranked.slice(0, 1).map((p) => p.player_number);
    const isWinner = winners.includes(playerNumber);
    let rank: number;
    if (isWinner) {
      rank = winners.indexOf(playerNumber) + 1;
    } else {
      const rest = ranked.filter((p) => !winners.includes(p.player_number));
      const idx = rest.findIndex((p) => p.player_number === playerNumber);
      rank = idx >= 0 ? winners.length + idx + 1 : 0;
    }

    const creditsBefore = (user.credits as number) ?? 0;
    const creditsAfter = creditsBefore + creditGain;
    const totalScore = players.find((p) => p.player_number === playerNumber)?.total_score ?? 0;

    return NextResponse.json({
      nickname: (user.nickname as string) ?? '플레이어',
      gameName,
      playerNumber,
      rank,
      totalScore,
      creditsBefore,
      creditsAfter,
      creditGain,
    });
  } catch (err) {
    console.error('logout-lookup 오류:', err);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
