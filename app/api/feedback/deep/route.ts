import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEEP_FEEDBACK_CREDIT = 2000;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      session_id: sessionId,
      game_name: gameName,
      feedback_data: feedbackData,
      free_text: freeText,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }
    const nameTrim = name.trim();

    const phoneNorm = normalizePhone(String(phone ?? ''));
    if (phoneNorm.length < 10) {
      return NextResponse.json({ error: '올바른 전화번호를 입력해주세요.' }, { status: 400 });
    }

    // user_info에서 이름 + 전화번호로 조회 (전화번호는 숫자만 비교)
    const { data: users, error: userError } = await supabase
      .from('user_info')
      .select('id, credits, phone')
      .eq('name', nameTrim);

    if (userError) {
      console.error('user_info 조회:', userError);
      return NextResponse.json({ error: '회원 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const user = (users ?? []).find((u) => {
      const dbPhone = normalizePhone(String((u as { phone?: string }).phone ?? ''));
      return dbPhone === phoneNorm;
    });

    let userId: string | null = null;
    if (user) {
      userId = (user as { id: string }).id;
    }

    // 세션당 1회 제한 (회원인 경우만)
    if (userId) {
      let existingQuery = supabase.from('deep_feedback').select('id').eq('user_id', userId);
      existingQuery = sessionId ? existingQuery.eq('session_id', sessionId) : existingQuery.is('session_id', null);
      const { data: existing } = await existingQuery.limit(1).maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: '이미 해당 세션의 심층 피드백을 제출하셨습니다. 세션당 1회만 참여 가능합니다.' },
          { status: 409 }
        );
      }
    }

    // 1. 회원이면 크레딧 지급
    if (user) {
      const currentCredits = ((user as { credits?: number }).credits ?? 0);
      const { error: updateError } = await supabase
        .from('user_info')
        .update({ credits: currentCredits + DEEP_FEEDBACK_CREDIT })
        .eq('id', userId);

      if (updateError) {
        console.error('credits 업데이트:', updateError);
        return NextResponse.json({ error: '크레딧 지급 중 오류가 발생했습니다.' }, { status: 500 });
      }
    }

    // 2. 피드백 저장 (회원 여부와 관계없이 항상 저장)
    const { error: insertError } = await supabase.from('deep_feedback').insert({
      user_id: userId,
      session_id: sessionId || null,
      game_name: gameName || null,
      feedback_data: feedbackData && typeof feedbackData === 'object' ? feedbackData : {},
      free_text: typeof freeText === 'string' ? freeText.slice(0, 2000) : null,
      submit_name: nameTrim,
      submit_phone: phoneNorm,
    });

    if (insertError) {
      console.error('deep_feedback insert:', insertError);
      return NextResponse.json({ error: '피드백 저장 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, credits_granted: !!user });
  } catch (err) {
    console.error('feedback/deep 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
