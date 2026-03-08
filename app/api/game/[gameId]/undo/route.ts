import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!gameId) {
    return NextResponse.json({ error: 'gameId required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('undo_last_action', {
    p_game_id: gameId,
  });

  if (error) {
    console.error('Undo 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ undone: data });
}
