import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const limit = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)));

  const { data: game, error: gErr } = await supabase.from('game_0b').select('game_id').eq('session_id', sessionId).maybeSingle();

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }
  if (!game) return NextResponse.json({ events: [] });

  const { data: events, error } = await supabase
    .from('game_0b_event')
    .select('*')
    .eq('game_id', game.game_id)
    .order('seq', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [] });
}
