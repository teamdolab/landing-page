import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { finalizeGame } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdminSession())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const nominatedPlayer = body?.nominated_player as number | undefined;

    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    if (
      nominatedPlayer != null &&
      (!Number.isInteger(nominatedPlayer) || nominatedPlayer < 1)
    ) {
      return NextResponse.json({ error: 'nominated_player 형식 오류' }, { status: 400 });
    }

    const result = await finalizeGame(
      sessionId.trim(),
      nominatedPlayer == null ? undefined : nominatedPlayer,
    );

    return NextResponse.json({
      success: true,
      snapshot: result.snapshot,
      public: result.public,
      event: result.event,
      final_result: result.finalResult,
    });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
