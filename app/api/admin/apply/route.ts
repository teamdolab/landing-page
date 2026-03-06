import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from('apply')
    .select(`
      id,
      user_id,
      used_credits,
      final_price,
      status,
      deposit_confirmed,
      recipient_name,
      recipient_phone,
      user_info(name, phone)
    `)
    .eq('session_id', sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (data || []).map((item: any) => ({
    id: item.id,
    user_name: item.recipient_name ?? item.user_info?.name ?? '',
    phone: item.recipient_phone ?? item.user_info?.phone ?? '',
    used_credits: item.used_credits,
    final_price: item.final_price,
    status: item.status,
    deposit_confirmed: item.deposit_confirmed ?? false,
  }));
  return NextResponse.json(formatted);
}
