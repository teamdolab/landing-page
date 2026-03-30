'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Game0bRow } from '@/lib/game-0b-types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useGame0b(sessionId: string | null) {
  const [game, setGame] = useState<Game0bRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId?.trim()) {
      setGame(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/game/game_0b/session/${encodeURIComponent(sessionId.trim())}`);
      const j = await res.json();
      setGame(j && !j.error ? (j as Game0bRow) : null);
    } catch {
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sid = sessionId?.trim();
    if (!sid) return;
    const channel = supabase
      .channel(`game-0b-${sid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_0b', filter: `session_id=eq.${sid}` },
        () => load()
      )
      .subscribe();
    const poll = setInterval(load, 3000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [sessionId, load]);

  return { game, loading, reload: load };
}
