import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logAdminAction } from '@/lib/audit-log';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applyId: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { applyId } = await params;
  const body = await request.json();
  const { error } = await getSupabaseAdmin()
    .from('apply')
    .update(body)
    .eq('id', applyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction('deposit_toggle', 'apply', applyId, body);

  return NextResponse.json({ ok: true });
}
