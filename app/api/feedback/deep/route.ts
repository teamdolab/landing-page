import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const DEEP_FEEDBACK_CREDIT = 1500;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const {
      identifier,        // 닉네임 또는 전화번호 뒷 4자리 (선택)
      session_id: sessionId,
      game_name: gameName,
      feedback_data: feedbackData,
      free_text: freeText,
    } = body;

    // identifier: 닉네임(문자 포함) 또는 전화 뒷 4자리(숫자 4자리)
    let userId: string | null = null;
    let creditGranted = 0;
    let creditGrantedAt: string | null = null;

    if (identifier && typeof identifier === 'string' && identifier.trim().length > 0) {
      const id = identifier.trim();
      const isPin = /^\d{4}$/.test(id);

      if (isPin) {
        // 전화번호 뒷 4자리로 매칭
        const { data: users } = await supabase
          .from('user_info')
          .select('id, credits, pin')
          .eq('pin', id);

        if (users && users.length === 1) {
          userId = (users[0] as { id: string }).id;
        }
        // 동일 PIN이 여러 명이면 특정 불가 → userId null 유지
      } else {
        // 닉네임으로 매칭
        const { data: users } = await supabase
          .from('user_info')
          .select('id, credits')
          .eq('nickname', id);

        if (users && users.length === 1) {
          userId = (users[0] as { id: string }).id;
        }
      }
    }

    // 세션당 1회 제한 (회원인 경우만)
    if (userId) {
      let existingQuery = supabase
        .from('deep_feedback')
        .select('id')
        .eq('user_id', userId);
      existingQuery = sessionId
        ? existingQuery.eq('session_id', sessionId)
        : existingQuery.is('session_id', null);
      const { data: existing } = await existingQuery.limit(1).maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: '이미 해당 세션의 심층 피드백을 제출하셨습니다. 세션당 1회만 참여 가능합니다.' },
          { status: 409 }
        );
      }

      // 크레딧 지급
      const { data: user } = await supabase
        .from('user_info')
        .select('credits')
        .eq('id', userId)
        .single();

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
        creditGranted = DEEP_FEEDBACK_CREDIT;
        creditGrantedAt = new Date().toISOString();
      }
    }

    // 피드백 저장 (회원 여부와 관계없이 항상)
    const { error: insertError } = await supabase.from('deep_feedback').insert({
      user_id: userId,
      session_id: sessionId ?? null,
      game_name: gameName ?? null,
      feedback_data: feedbackData && typeof feedbackData === 'object' ? feedbackData : {},
      free_text: typeof freeText === 'string' ? freeText.slice(0, 2000) : null,
      submit_name: null,
      submit_phone: null,
      credit_granted: creditGranted,
      credit_granted_at: creditGrantedAt,
    });

    if (insertError) {
      console.error('deep_feedback insert:', insertError);
      return NextResponse.json({ error: '피드백 저장 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      credits_granted: creditGranted > 0,
      credit_amount: creditGranted,
    });
  } catch (err) {
    console.error('feedback/deep 오류:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
