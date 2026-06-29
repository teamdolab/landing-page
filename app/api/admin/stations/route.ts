import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('stations')
    .select('*')
    .order('store_name', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stations: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const store_name = typeof body.store_name === 'string' ? body.store_name.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!store_name || !name) {
    return NextResponse.json({ error: 'store_name, name 필수' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('stations')
    .insert({ store_name, name })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '같은 매장에 동일한 팀 이름이 이미 등록되어 있습니다.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
