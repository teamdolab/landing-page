import { NextRequest, NextResponse } from 'next/server';
import { claimCredit } from '@/lib/settlement';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
    const playerNumber = Number(body?.player_number);

    if (!sessionId || !Number.isInteger(playerNumber) || playerNumber < 1) {
      return NextResponse.json({ error: 'session_id, player_number 필수' }, { status: 400 });
    }

    const outcome = await claimCredit(sessionId, playerNumber);

    if (outcome.alreadyClaimed) {
      return NextResponse.json({
        status: 'already_claimed',
        message: '이미 수령한 크레딧입니다',
      });
    }

    if (!outcome.claimed) {
      return NextResponse.json({
        status: 'not_ready',
        message: '게임이 아직 종료되지 않았습니다',
      });
    }

    const creditGain = (outcome.creditsAfter ?? 0) - (outcome.creditsBefore ?? 0);
    return NextResponse.json({
      status: 'claimed',
      message: `크레딧 ${creditGain.toLocaleString()}원이 지급되었습니다`,
      creditGain,
      creditsAfter: outcome.creditsAfter,
    });
  } catch (err) {
    console.error('game_0b claim-credit:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
