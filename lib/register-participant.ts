import { getSupabaseAdmin } from './supabase-admin';

export type RegisterParticipantResult = {
  registered: true;
  player_number: number;
  user_id: string;
};

export async function registerParticipant(params: {
  session_id: string;
  player_number: number;
  user_id: string;
}): Promise<RegisterParticipantResult> {
  const session_id = params.session_id.trim();
  const user_id = params.user_id.trim();
  const player_number = params.player_number;

  if (!session_id || !user_id || !Number.isInteger(player_number) || player_number < 1) {
    throw new Error('session_id, player_number, user_id 필수');
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: findError } = await supabase
    .from('game_participants')
    .select('id')
    .eq('session_id', session_id)
    .eq('player_number', player_number)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('game_participants')
      .update({ user_id, status: 'active' })
      .eq('id', existing.id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('game_participants')
      .insert({
        session_id,
        player_number,
        user_id,
        status: 'active',
      });

    if (insertError) throw insertError;
  }

  return {
    registered: true,
    player_number,
    user_id,
  };
}
