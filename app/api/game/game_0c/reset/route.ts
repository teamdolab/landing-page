import { NextRequest, NextResponse } from 'next/server';
import { resetGame } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;

    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    await resetGame(sessionId.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
