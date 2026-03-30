import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('game_0b').select('*').eq('session_id', sessionId).maybeSingle();

  if (error) {
    console.error('game_0b 조회:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) return NextResponse.json(null);

  return NextResponse.json(data);
}
