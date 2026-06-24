import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getFinalResult } from '@/lib/game-0c-engine';
import { handleGame0cRouteError } from '../_helpers';

export async function GET(req: NextRequest) {
  try {
    if (!(await verifyAdminSession())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = req.nextUrl.searchParams.get('session_id')?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const result = await getFinalResult(sessionId);
    return NextResponse.json(result);
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
