import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizeActiveSessionId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  if (!('active_session_id' in body)) {
    return NextResponse.json({ error: 'active_session_id 필수' }, { status: 400 });
  }

  const active_session_id = normalizeActiveSessionId(body.active_session_id);
  const supabase = getSupabaseAdmin();

  const { data: row, error: fetchError } = await supabase
    .from('stations')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (active_session_id) {
    const { data: taken, error: takenError } = await supabase
      .from('stations')
      .select('id')
      .eq('active_session_id', active_session_id)
      .neq('id', id)
      .maybeSingle();

    if (takenError) return NextResponse.json({ error: takenError.message }, { status: 500 });
    if (taken) {
      return NextResponse.json(
        { error: '이미 다른 팀 자리에서 사용 중인 세션입니다.' },
        { status: 409 },
      );
    }
  }

  const { data, error: updateError } = await supabase
    .from('stations')
    .update({ active_session_id })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: row, error: fetchError } = await supabase
    .from('stations')
    .select('id, active_session_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (row.active_session_id != null && String(row.active_session_id).trim() !== '') {
    return NextResponse.json({ error: '진행 중인 세션이 있습니다' }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from('stations')
    .delete()
    .eq('id', id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
