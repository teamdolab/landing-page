import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logAdminAction } from '@/lib/audit-log';

/** 마스터 테이블 화이트리스트: 테이블명 → 허용 컬럼 */
const MASTER_TABLES: Record<string, string[]> = {
  stores: ['code', 'name', 'active'],
  seasons: ['code', 'name', 'active'],
  game_types: ['code', 'name', 'game_kind', 'active'],
};

function pickAllowed(table: string, body: Record<string, unknown>): Record<string, unknown> {
  const allowed = MASTER_TABLES[table];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

/** 행 추가 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { table } = await params;
  if (!MASTER_TABLES[table]) {
    return NextResponse.json({ error: '잘못된 테이블' }, { status: 400 });
  }

  const body = await request.json();
  const row = pickAllowed(table, body);
  if (!row.code || !row.name) {
    return NextResponse.json({ error: 'code, name 필수' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from(table).insert(row);
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 존재하는 코드입니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction('master_create', table, String(row.code), row);

  return NextResponse.json({ ok: true });
}

/** 행 수정 (이름 변경 / 활성 토글). body.code로 대상 지정 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { table } = await params;
  if (!MASTER_TABLES[table]) {
    return NextResponse.json({ error: '잘못된 테이블' }, { status: 400 });
  }

  const body = await request.json();
  const code = body?.code as string | undefined;
  if (!code) {
    return NextResponse.json({ error: 'code 필수' }, { status: 400 });
  }

  const updates = pickAllowed(table, body);
  delete updates.code;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '수정할 항목 없음' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from(table).update(updates).eq('code', code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction('master_update', table, code, updates);

  return NextResponse.json({ ok: true });
}
