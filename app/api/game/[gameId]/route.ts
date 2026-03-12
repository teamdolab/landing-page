import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dbRowToApi, type GameRow } from '@/lib/game-transform';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!gameId) {
    return NextResponse.json({ error: 'gameId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('game_0a')
    .select('*')
    .eq('game_id', gameId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(null);
    }
    console.error('game_0a 조회 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(dbRowToApi(data as GameRow));
}
