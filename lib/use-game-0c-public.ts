'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Game0cForcePair, Game0cPhase, Game0cPublicRow } from '@/lib/game-0c-types';

function toPublicRow(row: Record<string, unknown>): Game0cPublicRow {
  return {
    session_id: row.session_id as string,
    round: row.round as number | null,
    phase: row.phase as Game0cPhase | null,
    timer_end: row.timer_end as string | null,
    force_candidates: Array.isArray(row.force_candidates) ? row.force_candidates : [],
    bid_results: Array.isArray(row.bid_results) ? row.bid_results : [],
    force_pairs: (row.force_pairs ?? []) as Game0cForcePair[],
    updated_at: row.updated_at as string,
  };
}

/** game_0c_public 실시간 구독 (anon) */
export function useGame0cPublic(sessionId: string | null) {
  const [publicData, setPublicData] = useState<Game0cPublicRow | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const sid = sessionId?.trim();
    if (!sid) {
      setPublicData(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_0c_public')
        .select('*')
        .eq('session_id', sid)
        .maybeSingle();

      if (error) {
        console.error('game_0c_public 조회:', error);
        setPublicData(null);
        return;
      }
      setPublicData(data ? toPublicRow(data as Record<string, unknown>) : null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const sid = sessionId?.trim();
    if (!sid) return;

    const channel = supabase
      .channel(`game-0c-public-${sid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_0c_public',
          filter: `session_id=eq.${sid}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            setPublicData(toPublicRow(payload.new as Record<string, unknown>));
            return;
          }
          reload();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, reload]);

  return { publicData, loading, reload };
}

/** timer_end 기준 남은 초 */
export function useTimerCountdown(timerEnd: string | null | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!timerEnd) {
      setRemaining(null);
      return;
    }
    const calc = () => {
      const diff = new Date(timerEnd).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };
    setRemaining(calc());
    const id = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(id);
  }, [timerEnd]);

  return remaining;
}
