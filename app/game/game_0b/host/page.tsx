'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame0b } from '@/lib/use-game-0b';
import type { Game0bEventRow } from '@/lib/game-0b-types';
import '../game-0b.css';

function HostContent() {
  const searchParams = useSearchParams();
  const param = searchParams.get('session')?.trim() || '';
  const [sessionId, setSessionId] = useState(param);
  const [events, setEvents] = useState<Game0bEventRow[]>([]);
  const [eventType, setEventType] = useState('phase_start');
  const [eventJson, setEventJson] = useState('{}');
  const [msg, setMsg] = useState<string | null>(null);

  const { game, loading, reload } = useGame0b(sessionId || null);

  const loadEvents = useCallback(async () => {
    if (!sessionId?.trim()) return;
    const res = await fetch(`/api/game/game_0b/session/${encodeURIComponent(sessionId.trim())}/events?limit=80`);
    const j = await res.json();
    setEvents(Array.isArray(j.events) ? j.events : []);
  }, [sessionId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents, game?.updated_at]);

  const initGame = async () => {
    if (!sessionId?.trim()) return;
    setMsg(null);
    const res = await fetch('/api/game/game_0b/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId.trim() }),
    });
    const j = await res.json();
    if (!res.ok) setMsg(j.error || '실패');
    else {
      setMsg('초기화됨');
      reload();
      loadEvents();
    }
  };

  const appendEvent = async () => {
    if (!sessionId?.trim()) return;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(eventJson || '{}') as Record<string, unknown>;
    } catch {
      setMsg('event_data JSON 오류');
      return;
    }
    setMsg(null);
    const res = await fetch('/api/game/game_0b/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId.trim(),
        event_type: eventType,
        source: 'host',
        event_data: data,
      }),
    });
    const j = await res.json();
    if (!res.ok) setMsg(j.error || '실패');
    else {
      setMsg(`이벤트 #${j.seq}`);
      loadEvents();
    }
  };

  if (!sessionId) {
    return (
      <div className="game-0b-root min-h-screen bg-[var(--g0b-bg)] flex items-center justify-center p-6">
        <form
          className="w-full max-w-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = (e.currentTarget.elements.namedItem('session') as HTMLInputElement)?.value?.trim();
            if (v) setSessionId(v);
          }}
        >
          <h1 className="text-lg font-semibold text-[var(--g0b-text)]">GAME 0B · 진행자</h1>
          <input
            name="session"
            placeholder="세션 ID"
            className="w-full px-4 py-3 rounded-lg bg-[var(--g0b-surface)] border border-white/10 text-[var(--g0b-text)]"
          />
          <button type="submit" className="w-full py-3 rounded-lg bg-[var(--g0b-accent)] text-[#0a0e14] font-bold">
            입장
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="game-0b-root min-h-screen bg-[var(--g0b-bg)] text-[var(--g0b-text)] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex flex-wrap gap-4 justify-between items-start">
          <div>
            <button type="button" onClick={() => setSessionId('')} className="text-sm text-[var(--g0b-muted)] mb-2">
              ← 세션 변경
            </button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-orbitron)' }}>
              진행자 · {sessionId}
            </h1>
          </div>
          <a
            href={`/game/game_0b/display?session=${encodeURIComponent(sessionId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg border border-[var(--g0b-accent)] text-[var(--g0b-accent)]"
          >
            송출 열기
          </a>
        </header>

        {loading && !game && <p className="text-[var(--g0b-muted)]">로딩…</p>}

        {game && (
          <section className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-[var(--g0b-surface)] p-4">
              <div className="text-sm text-[var(--g0b-muted)]">스냅샷</div>
              <div className="mt-2 space-y-1 font-mono text-sm">
                <div>수송선 {game.ship_hull}%</div>
                <div>
                  라운드 {game.current_round} · {game.phase}
                </div>
                <div>상태 {game.status}</div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[var(--g0b-surface)] p-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={initGame}
                className="py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
              >
                세션에 game_0b 없으면 생성 (init)
              </button>
              <p className="text-xs text-[var(--g0b-muted)]">이미 있으면 기존 행 반환</p>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-[var(--g0b-surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--g0b-muted)]">이벤트 추가 (host)</h2>
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="event_type"
            className="w-full px-3 py-2 rounded bg-[#0a0e14] border border-white/10 text-sm"
          />
          <textarea
            value={eventJson}
            onChange={(e) => setEventJson(e.target.value)}
            rows={4}
            placeholder='event_data JSON (예: {"note":"테스트"})'
            className="w-full px-3 py-2 rounded bg-[#0a0e14] border border-white/10 text-sm font-mono"
          />
          <button type="button" onClick={appendEvent} className="px-4 py-2 rounded-lg bg-[var(--g0b-accent)] text-[#0a0e14] font-semibold text-sm">
            event 로그에 추가
          </button>
          {msg && <p className="text-sm text-[var(--g0b-accent)]">{msg}</p>}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-[var(--g0b-muted)] mb-2">최근 이벤트</h2>
          <ul className="space-y-2 max-h-80 overflow-y-auto font-mono text-xs">
            {events.map((ev) => (
              <li key={ev.id} className="rounded border border-white/5 p-2 bg-black/20">
                <span className="text-[var(--g0b-accent)]">#{ev.seq}</span> {ev.event_type}{' '}
                <span className="text-[var(--g0b-muted)]">{ev.source}</span>
                <pre className="mt-1 text-[var(--g0b-muted)] whitespace-pre-wrap break-all">
                  {JSON.stringify(ev.event_data)}
                </pre>
              </li>
            ))}
          </ul>
          {events.length === 0 && <p className="text-[var(--g0b-muted)] text-sm">이벤트 없음</p>}
        </section>
      </div>
    </div>
  );
}

export default function Game0bHostPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0e14] text-slate-400 flex items-center justify-center">로딩…</div>}>
      <HostContent />
    </Suspense>
  );
}
