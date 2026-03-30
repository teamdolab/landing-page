import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** game_0b_event 한 건 추가 (seq=0 이면 DB 트리거가 max+1) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const eventType = body?.event_type as string | undefined;
    const source = body?.source as string | undefined;
    const actorPlayerNumber = body?.actor_player_number as number | undefined | null;
    const eventData = body?.event_data;
    const seq = body?.seq as number | undefined;

    if (!sessionId?.trim() || !eventType?.trim()) {
      return NextResponse.json({ error: 'session_id, event_type 필수' }, { status: 400 });
    }
    if (!source || !['host', 'testroom', 'system'].includes(source)) {
      return NextResponse.json({ error: 'source는 host | testroom | system' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: game, error: gErr } = await supabase
      .from('game_0b')
      .select('game_id')
      .eq('session_id', sessionId.trim())
      .maybeSingle();

    if (gErr || !game) {
      return NextResponse.json({ error: 'game_0b 없음. /api/game/game_0b/init 먼저 호출' }, { status: 404 });
    }

    const insert: Record<string, unknown> = {
      game_id: game.game_id,
      event_type: eventType.trim(),
      source,
      actor_player_number: actorPlayerNumber ?? null,
      event_data:
        eventData && typeof eventData === 'object' && !Array.isArray(eventData) ? eventData : {},
    };
    if (typeof seq === 'number' && seq > 0) insert.seq = seq;
    else insert.seq = 0;

    const { data: ev, error } = await supabase.from('game_0b_event').insert(insert).select('*').single();

    if (error) {
      console.error('game_0b_event insert:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(ev);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
