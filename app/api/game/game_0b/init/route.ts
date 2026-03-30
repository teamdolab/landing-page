import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function buildInsert(sessionId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    session_id: sessionId,
    status: '진행중',
    current_round: 1,
    phase: 'day',
    ship_hull: 100,
    info_text: 'GAME 0B — 대기',
  };
  for (let i = 1; i <= 12; i++) {
    const k = String(i).padStart(2, '0');
    row[`player_${k}_core`] = 3;
  }
  return row;
}

/** 세션에 game_0b 행이 없으면 생성 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('game_0b')
      .select('*')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(existing);
    }

    const { data, error } = await supabase.from('game_0b').insert(buildInsert(sessionId.trim())).select('*').single();

    if (error) {
      console.error('game_0b init:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
