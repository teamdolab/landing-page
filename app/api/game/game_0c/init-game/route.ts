import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { initGame } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdminSession())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const playerCount = body?.player_count as number | undefined;

    if (
      !sessionId?.trim()
      || playerCount == null
      || !Number.isInteger(playerCount)
      || playerCount < 8
      || playerCount > 12
    ) {
      return NextResponse.json(
        { error: 'session_id, player_count(8~12) 필수' },
        { status: 400 },
      );
    }

    const result = await initGame(sessionId.trim(), playerCount);

    return NextResponse.json({
      success: true,
      snapshot: result.snapshot,
      public: result.public,
    });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
