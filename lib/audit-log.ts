import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * admin 액션 감사 로그 기록.
 * 실패해도 본 요청 흐름에 영향을 주지 않도록 fire-and-forget으로 사용한다.
 */
export async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin().from('admin_audit_log').insert({
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail ?? null,
    });
    if (error) console.error('audit log insert 실패:', error.message);
  } catch (err) {
    console.error('audit log 오류:', err);
  }
}
