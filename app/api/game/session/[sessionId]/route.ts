import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dbRowToApi, type GameRow } from '@/lib/game-transform';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: gameData, error } = await supabase
    .from('game_0a')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('game_0a 조회 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!gameData) return NextResponse.json(null);

  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('game_name')
    .eq('session_id', sessionId)
    .maybeSingle();

  const gameName = (sessionRow as { game_name?: string } | null)?.game_name ?? sessionId;
  const api = dbRowToApi(gameData as GameRow) as Record<string, unknown>;
  api.game_name = gameName;

  return NextResponse.json(api);
}
