import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body?.name as string | undefined)?.trim();
    const phone = String(body?.phone ?? '').replace(/\D/g, '');

    if (!name || phone.length < 10) {
      return NextResponse.json({ error: '성명과 전화번호가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('user_info')
      .select('id, nickname, credits')
      .eq('name', name)
      .eq('phone', phone)
      .maybeSingle();

    if (error) {
      console.error('check-user DB error:', error);
      return NextResponse.json({ error: '유저 정보를 확인하는데 실패했습니다.' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({
        user_exists: false,
        user_id: null,
        nickname: null,
        credits: 0,
      });
    }

    return NextResponse.json({
      user_exists: true,
      user_id: user.id,
      nickname: user.nickname,
      credits: user.credits ?? 0,
    });
  } catch (err) {
    console.error('check-user API error:', err);
    return NextResponse.json({ error: '유저 정보를 확인하는데 실패했습니다.' }, { status: 500 });
  }
}
