import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type LandingGameType = {
  code: string;
  name: string;
  intro_text: string | null;
  is_coming_soon: boolean;
};

/** 랜딩 게임 소개용 공개 조회 (game_types RLS는 service role 경유) */
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('game_types')
      .select('code, name, intro_text, is_coming_soon')
      .eq('active', true)
      .order('code');

    if (error) {
      console.error('[landing/game-types]', error.message);
      return NextResponse.json({ game_types: [] as LandingGameType[] });
    }

    return NextResponse.json({
      game_types: (data ?? []).map((row) => ({
        code: row.code,
        name: row.name,
        intro_text: row.intro_text ?? null,
        is_coming_soon: Boolean(row.is_coming_soon),
      })),
    });
  } catch (err) {
    console.error('[landing/game-types]', err);
    return NextResponse.json({ game_types: [] as LandingGameType[] });
  }
}
