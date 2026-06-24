import { NextRequest, NextResponse } from 'next/server';
import { processVariation } from '@/lib/game-0c-engine';
import type { Game0cVariationChoice } from '@/lib/game-0c-types';
import { handleGame0cRouteError } from '../_helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body?.session_id as string | undefined;
    const round = body?.round as number | undefined;
    const player = body?.player as number | undefined;
    const choice = body?.choice as Game0cVariationChoice | undefined;

    if (
      !sessionId?.trim()
      || round == null
      || !Number.isInteger(round)
      || round < 1
      || !player
      || (choice !== 'doctor' && choice !== 'zombie')
    ) {
      return NextResponse.json(
        { error: 'session_id, round, player, choice(doctor|zombie) 필수' },
        { status: 400 },
      );
    }

    const result = await processVariation(sessionId.trim(), round, player, choice);

    return NextResponse.json({
      success: true,
      event_id: result.event.id,
      success_variation: result.event.payload_private.success,
      probed_state: result.event.payload_private.probed_state,
      snapshot: result.snapshot,
    });
  } catch (e) {
    return handleGame0cRouteError(e);
  }
}
