import { NextRequest, NextResponse } from 'next/server';
import { processContact } from '@/lib/game-0c-engine';
import type { Game0cContactType } from '@/lib/game-0c-types';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const round = body?.round as number | undefined;
    const playerA = body?.player_a as number | undefined;
    const playerB = body?.player_b as number | undefined;
    const contactType = body?.contact_type as Game0cContactType | undefined;

    if (
      !sessionId?.trim()
      || round == null
      || !Number.isInteger(round)
      || round < 1
      || !playerA
      || !playerB
      || (contactType !== 'normal' && contactType !== 'force')
    ) {
      return NextResponse.json(
        { error: 'session_id, round, player_a, player_b, contact_type(normal|force) 필수' },
        { status: 400 },
      );
    }

    const result = await processContact(
      sessionId.trim(),
      round,
      playerA,
      playerB,
      contactType,
    );

    return NextResponse.json({
      success: true,
      event_id: result.event.id,
      snapshot: result.snapshot,
      public: result.public,
      result: result.event.payload_private.result,
    });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
