import { NextRequest, NextResponse } from 'next/server';
import { getBoothState } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('session_id')?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const state = await getBoothState(sessionId);
    return NextResponse.json(state);
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
