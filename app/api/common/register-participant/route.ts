import { NextRequest, NextResponse } from 'next/server';
import { registerParticipant } from '@/lib/register-participant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session_id = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
    const user_id = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    const player_number = Number(body?.player_number);

    if (!session_id || !user_id || !Number.isInteger(player_number) || player_number < 1) {
      return NextResponse.json(
        { error: 'session_id, player_number, user_id 필수' },
        { status: 400 },
      );
    }

    const result = await registerParticipant({ session_id, player_number, user_id });
    return NextResponse.json(result);
  } catch (err) {
    console.error('register-participant API:', err);
    const message = err instanceof Error ? err.message : '입장 등록에 실패했습니다';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
