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

  try {
    // 1. game_participants active 행 정리 (이력 보존, status만 변경)
    const { error: participantsError } = await supabase
      .from('game_participants')
      .update({ status: 'completed' })
      .eq('game_id', gameId)
      .eq('status', 'active');

    if (participantsError) {
      console.error('game_participants 정리 에러:', participantsError);
      return NextResponse.json({ error: participantsError.message }, { status: 500 });
    }

    // 2. game_0a 삭제
    const { error } = await supabase
      .from('game_0a')
      .delete()
      .eq('game_id', gameId);

    if (error) {
      console.error('게임 삭제 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('게임 초기화 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
