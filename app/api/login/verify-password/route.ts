import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword, verifyPasswordWithMigration } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.user_id as string | undefined;
    const password = body?.password as string | undefined;

    if (!userId?.trim()) {
      return NextResponse.json({ error: 'user_id 필수' }, { status: 400 });
    }
    if (!password || password.length !== 4) {
      return NextResponse.json({ error: '4자리 패스워드가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('user_info')
      .select('id, password, credits')
      .eq('id', userId.trim())
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: '패스워드가 일치하지 않습니다.' }, { status: 401 });
    }

    const result = await verifyPasswordWithMigration(password, user.password as string | null);
    if (!result.valid) {
      return NextResponse.json({ error: '패스워드가 일치하지 않습니다.' }, { status: 401 });
    }

    if (result.needsRehash) {
      const hashed = await hashPassword(password);
      const { error: updateError } = await supabase
        .from('user_info')
        .update({ password: hashed })
        .eq('id', user.id);

      if (updateError) {
        console.error('Password rehash failed:', updateError.message);
        return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }
    }

    return NextResponse.json({
      id: user.id,
      credits: (user.credits as number) ?? 0,
    });
  } catch (err) {
    console.error('verify-password API error:', err);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
