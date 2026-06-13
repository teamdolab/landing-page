import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type SettlementRow = {
  session_id: string;
  game_name: string;
  session_date: string;
  session_time: string;
  deleted: boolean;
  apply_count: number;
  confirmed_count: number;
  revenue: number;       // 입금확정(deposit_confirmed) 건의 final_price 합
  credits_used: number;  // 입금확정 건의 used_credits 합
};

/** 세션별 정산 집계 (soft delete된 세션도 이력 보존 차원에서 포함) */
export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();

  const [sessionsRes, appliesRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('session_id, game_name, session_date, session_time, deleted_at')
      .order('session_date', { ascending: false })
      .order('session_time', { ascending: false }),
    supabase
      .from('apply')
      .select('session_id, status, deposit_confirmed, final_price, used_credits'),
  ]);

  if (sessionsRes.error) {
    return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
  }
  if (appliesRes.error) {
    return NextResponse.json({ error: appliesRes.error.message }, { status: 500 });
  }

  const bySession = new Map<string, { apply: number; confirmed: number; revenue: number; credits: number }>();
  for (const a of appliesRes.data ?? []) {
    const agg = bySession.get(a.session_id) ?? { apply: 0, confirmed: 0, revenue: 0, credits: 0 };
    if (a.status === '신청중' || a.status === '확정') {
      agg.apply += 1;
      if (a.deposit_confirmed) {
        agg.confirmed += 1;
        agg.revenue += a.final_price ?? 0;
        agg.credits += a.used_credits ?? 0;
      }
    }
    bySession.set(a.session_id, agg);
  }

  const rows: SettlementRow[] = (sessionsRes.data ?? []).map((s) => {
    const agg = bySession.get(s.session_id) ?? { apply: 0, confirmed: 0, revenue: 0, credits: 0 };
    return {
      session_id: s.session_id,
      game_name: s.game_name,
      session_date: s.session_date,
      session_time: s.session_time,
      deleted: s.deleted_at != null,
      apply_count: agg.apply,
      confirmed_count: agg.confirmed,
      revenue: agg.revenue,
      credits_used: agg.credits,
    };
  });

  const total = rows.reduce(
    (acc, r) => ({
      apply_count: acc.apply_count + r.apply_count,
      confirmed_count: acc.confirmed_count + r.confirmed_count,
      revenue: acc.revenue + r.revenue,
      credits_used: acc.credits_used + r.credits_used,
    }),
    { apply_count: 0, confirmed_count: 0, revenue: 0, credits_used: 0 },
  );

  return NextResponse.json({ rows, total });
}
