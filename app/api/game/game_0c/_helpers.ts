import { NextResponse } from 'next/server';
import { Game0cEngineError } from '@/lib/game-0c-engine';

export function handleGame0cRouteError(e: unknown) {
  if (e instanceof Game0cEngineError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error('game_0c route:', e);
  return NextResponse.json({ error: '서버 오류' }, { status: 500 });
}
