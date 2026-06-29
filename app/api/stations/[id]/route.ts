import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: station, error } = await supabase
    .from('stations')
    .select('id, active_session_id')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!station) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const activeSessionId =
    station.active_session_id != null ? String(station.active_session_id).trim() : '';

  if (!activeSessionId) {
    return NextResponse.json({ active: false });
  }

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('session_id, game_kind')
    .eq('session_id', activeSessionId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    session_id: session.session_id,
    game_kind: session.game_kind,
  });
}
