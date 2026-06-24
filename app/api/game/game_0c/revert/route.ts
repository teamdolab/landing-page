import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { revertEvent } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdminSession())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const targetEventId = body?.target_event_id as number | undefined;
    const reason = body?.reason as string | undefined;

    if (!sessionId?.trim() || targetEventId == null || !Number.isInteger(targetEventId) || !reason?.trim()) {
      return NextResponse.json(
        { error: 'session_id, target_event_id, reason 필수' },
        { status: 400 },
      );
    }

    const result = await revertEvent(sessionId.trim(), targetEventId, reason.trim());

    return NextResponse.json({
      success: true,
      revert_event_id: result.revertEvent.id,
      snapshot: result.snapshot,
      public: result.public,
    });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
