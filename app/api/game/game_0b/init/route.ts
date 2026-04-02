import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ROLE_DISTRIBUTION, playerCoreKey, playerRoleKey } from '@/lib/game-0b-types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildInsert(
  sessionId: string,
  playerCount: number,
  firstPlayer: number,
): Record<string, unknown> {
  const roles = ROLE_DISTRIBUTION[playerCount];
  if (!roles) throw new Error(`Invalid player_count: ${playerCount}`);
  const shuffled = shuffle(roles);

  const row: Record<string, unknown> = {
    session_id: sessionId,
    status: '진행중',
    player_count: playerCount,
    current_round: 0,
    phase: 'setup',
    ship_hull: 100,
    first_player_number: firstPlayer,
    info_text: null,
    night_action_count: 0,
    detected_actions: [],
  };

  let commanderNum: number | null = null;

  for (let i = 1; i <= 12; i++) {
    if (i <= playerCount) {
      const role = shuffled[i - 1];
      row[playerRoleKey(i)] = role;
      row[playerCoreKey(i)] = 3;
      if (role === '사령관') commanderNum = i;
    } else {
      row[playerRoleKey(i)] = null;
      row[playerCoreKey(i)] = 0;
    }
  }

  row.commander_player_number = commanderNum;

  return row;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const playerCount = body?.player_count as number | undefined;
    const firstPlayer = body?.first_player_number as number | undefined;

    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'session_id 필수' }, { status: 400 });
    }

    const pc = playerCount ?? 12;
    const fp = firstPlayer ?? 1;

    if (pc < 8 || pc > 12) {
      return NextResponse.json({ error: 'player_count: 8~12' }, { status: 400 });
    }
    if (fp < 1 || fp > pc) {
      return NextResponse.json({ error: `first_player_number: 1~${pc}` }, { status: 400 });
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

    const { data, error } = await supabase
      .from('game_0b')
      .insert(buildInsert(sessionId.trim(), pc, fp))
      .select('*')
      .single();

    if (error) {
      console.error('game_0b init:', error);
      const msg = error.message || '';
      const missingTable = /Could not find the table|schema cache|does not exist|relation ["']game_0b/i.test(msg);
      const hint = missingTable
        ? ' Supabase SQL Editor에서 supabase-game-0b-schema.sql 전체를 실행한 뒤 다시 시도하세요.'
        : '';
      return NextResponse.json({ error: `${msg}${hint}` }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
