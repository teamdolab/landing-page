import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      nickname,
      password,
      privacy_consent,
      marketing_consent,
      referrer_phone,
    } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: '이름, 전화번호, 패스워드는 필수입니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from('user_info')
      .insert({
        name,
        phone: String(phone).replace(/\D/g, ''),
        nickname: nickname || null,
        password,
        privacy_consent: !!privacy_consent,
        privacy_consent_at: privacy_consent ? new Date().toISOString() : null,
        marketing_consent: !!marketing_consent,
        marketing_consent_at: marketing_consent ? new Date().toISOString() : null,
        referrer_phone: referrer_phone ? String(referrer_phone).replace(/\D/g, '') : null,
      })
      .select('id, credits')
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.includes('user_info_phone_key')) {
        return NextResponse.json(
          { error: '이미 가입한 계정이 있습니다. 처음 화면에서 이름과 전화번호로 로그인해주세요.' },
          { status: 409 }
        );
      }
      console.error('Signup error:', error);
      return NextResponse.json(
        { error: error.message || '가입에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      credits: data.credits ?? 0,
    });
  } catch (err) {
    console.error('Signup API error:', err);
    return NextResponse.json(
      { error: '가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
