'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame0b } from '@/lib/use-game-0b';
import '../game-0b.css';

function phaseLabel(phase: string) {
  if (phase === 'day') return '낮';
  if (phase === 'night') return '밤';
  if (phase === 'morning') return '아침 브리핑';
  return phase;
}

function DisplayContent() {
  const searchParams = useSearchParams();
  const param = searchParams.get('session')?.trim() || '';
  const [sessionId, setSessionId] = useState(param);

  const { game, loading } = useGame0b(sessionId || null);

  if (!sessionId) {
    return (
      <div className="game-0b-root min-h-screen bg-[var(--g0b-bg)] flex items-center justify-center p-8">
        <form
          className="w-full max-w-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = (e.currentTarget.elements.namedItem('session') as HTMLInputElement)?.value?.trim();
            if (v) setSessionId(v);
          }}
        >
          <h1 className="text-xl font-semibold text-[var(--g0b-text)] text-center" style={{ fontFamily: 'var(--font-orbitron)' }}>
            수송선게임 · 송출
          </h1>
          <input
            name="session"
            placeholder="세션 ID"
            className="w-full px-4 py-3 rounded-lg bg-[var(--g0b-surface)] border border-white/10 text-[var(--g0b-text)] placeholder:text-[var(--g0b-muted)]"
          />
          <button type="submit" className="w-full py-3 rounded-lg bg-[var(--g0b-accent)] text-[#0a0e14] font-bold">
            입장
          </button>
        </form>
      </div>
    );
  }

  if (loading && !game) {
    return (
      <div className="game-0b-root min-h-screen bg-[var(--g0b-bg)] flex items-center justify-center text-[var(--g0b-muted)]">
        로딩…
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-0b-root min-h-screen bg-[var(--g0b-bg)] flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-[var(--g0b-muted)]">해당 세션의 game_0b가 없습니다.</p>
        <button type="button" onClick={() => setSessionId('')} className="text-[var(--g0b-accent)] underline">
          세션 다시 입력
        </button>
      </div>
    );
  }

  return (
    <div className="game-0b-root min-h-screen bg-[var(--g0b-bg)] text-[var(--g0b-text)] flex flex-col">
      <header className="flex-shrink-0 border-b border-white/10 px-8 py-4 flex justify-between items-center">
        <div>
          <div className="text-xs text-[var(--g0b-muted)] tracking-widest">DO:LAB · SEASON 0</div>
          <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-orbitron)' }}>
            수송선게임
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-[var(--g0b-accent)]">{game.current_round} ROUND</div>
          <div className="text-sm text-[var(--g0b-muted)]">{phaseLabel(game.phase)}</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <section className="text-center max-w-2xl">
          <p className="text-sm text-[var(--g0b-muted)] mb-2">수송선 체력</p>
          <p
            className="text-7xl md:text-8xl font-black tabular-nums"
            style={{ fontFamily: 'var(--font-share-tech-mono)' }}
          >
            {game.ship_hull}
            <span className="text-3xl text-[var(--g0b-muted)] ml-2">%</span>
          </p>
        </section>

        {game.info_text && (
          <p className="text-lg md:text-xl text-center text-[var(--g0b-text)] border border-white/10 rounded-xl px-8 py-4 bg-[var(--g0b-surface)]">
            {game.info_text}
          </p>
        )}

        {game.last_public_transfer_from != null && (
          <p className="text-[var(--g0b-accent)]">
            {game.last_public_transfer_from}번 플레이어가 누군가에게 코어를 보냈습니다.
          </p>
        )}
      </main>
    </div>
  );
}

export default function Game0bDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center text-slate-400">로딩…</div>
      }
    >
      <DisplayContent />
    </Suspense>
  );
}
