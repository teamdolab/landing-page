import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logAdminAction } from '@/lib/audit-log';

/**
 * 세션 soft delete.
 * 1) 진행 중인 신청(신청중/확정)을 '취소'로 변경
 *    → DB 트리거가 크레딧 환불 + current_capacity 감소를 자동 처리
 * 2) sessions.deleted_at 마킹 (hard delete 없음, 정산 이력 보존)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sessionId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: cancelled, error: applyErr } = await supabase
    .from('apply')
    .update({ status: '취소' })
    .eq('session_id', sessionId)
    .in('status', ['신청중', '확정'])
    .select('id');

  if (applyErr) {
    return NextResponse.json({ error: `신청 취소 처리 실패: ${applyErr.message}` }, { status: 500 });
  }

  const { error } = await supabase
    .from('sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('session_id', sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction('session_delete', 'session', sessionId, {
    cancelled_applies: cancelled?.length ?? 0,
  });

  return NextResponse.json({ ok: true, cancelled_applies: cancelled?.length ?? 0 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sessionId } = await params;
  const body = await request.json();
  const { error } = await getSupabaseAdmin()
    .from('sessions')
    .update(body)
    .eq('session_id', sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction('session_update', 'session', sessionId, body);

  return NextResponse.json({ ok: true });
}
