import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { Game0cEventRow } from '@/lib/game-0c-types';
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
    const { data, error } = await supabase
      .from('game_0c_event')
      .select('*')
      .eq('session_id', sessionId)
      .order('id', { ascending: false })
      .limit(10);

    if (error) {
      console.error('game_0c_event 조회:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: (data ?? []) as Game0cEventRow[] });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
