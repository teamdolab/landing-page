import { NextRequest, NextResponse } from 'next/server';
import { setPendingContact } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const playerNumber = body?.player_number as number | undefined;

    if (!sessionId?.trim() || !playerNumber || !Number.isInteger(playerNumber)) {
      return NextResponse.json({ error: 'session_id, player_number 필수' }, { status: 400 });
    }

    const snapshot = await setPendingContact(sessionId.trim(), playerNumber);
    return NextResponse.json({ success: true, pending: snapshot.pending });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
