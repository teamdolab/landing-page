import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logAdminAction } from '@/lib/audit-log';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pageParam = request.nextUrl.searchParams.get('page');
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { data, error, count } = await getSupabaseAdmin()
    .from('sessions')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('session_date', { ascending: false })
    .order('session_time', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sessions: data ?? [],
    total: count ?? 0,
    page,
    page_size: PAGE_SIZE,
  });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { error } = await getSupabaseAdmin().from('sessions').insert(body);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction('session_create', 'session', body.session_id ?? null, {
    game_name: body.game_name,
    game_kind: body.game_kind,
    session_date: body.session_date,
    base_price: body.base_price,
  });

  return NextResponse.json({ ok: true });
}
