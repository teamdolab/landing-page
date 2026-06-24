import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { submitBid } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdminSession())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const round = body?.round as number | undefined;
    const player = body?.player as number | undefined;
    const bids = body?.bids as number | undefined;

    if (
      !sessionId?.trim()
      || round == null
      || !Number.isInteger(round)
      || round < 1
      || !player
      || bids == null
      || !Number.isInteger(bids)
    ) {
      return NextResponse.json(
        { error: 'session_id, round, player, bids(0~2) 필수' },
        { status: 400 },
      );
    }

    const result = await submitBid(sessionId.trim(), round, player, bids);
    return NextResponse.json({
      success: true,
      event_id: result.event.id,
      snapshot: result.snapshot,
    });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
