import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isGame0c, resolveGameKind } from '@/lib/session-game-kind';
import type { Game0cPhase, Game0cPlayer, Game0cSnapshotRow } from '@/lib/game-0c-types';
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

    const supabase = getSupabaseAdmin();

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('game_kind')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (sessionErr) {
      console.error('sessions 조회:', sessionErr);
      return NextResponse.json({ error: '세션 조회 실패' }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: '세션 없음' }, { status: 404 });
    }
    if (!isGame0c(resolveGameKind(session))) {
      return NextResponse.json({ error: 'game_0c 세션이 아님' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('game_0c_snapshot')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('game_0c_snapshot 조회:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ snapshot: null });
    }

    const snapshot: Game0cSnapshotRow = {
      ...data,
      players: (data.players ?? []) as Game0cPlayer[],
      phase: data.phase as Game0cPhase | null,
    };

    return NextResponse.json({ snapshot });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
