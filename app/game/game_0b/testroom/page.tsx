'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame0b } from '@/lib/use-game-0b';
import { getPlayerRoleCore } from '@/lib/game-0b-types';
import '../game-0b.css';

function TestroomContent() {
  const searchParams = useSearchParams();
  const paramSession = searchParams.get('session')?.trim() || '';
  const paramPlayer = parseInt(searchParams.get('player') || '', 10);
  const [sessionId, setSessionId] = useState(paramSession);
  const [playerNum, setPlayerNum] = useState(Number.isFinite(paramPlayer) && paramPlayer >= 1 && paramPlayer <= 12 ? paramPlayer : 1);

  const { game, loading } = useGame0b(sessionId || null);
  const { role, core } = game ? getPlayerRoleCore(game, playerNum) : { role: null, core: 0 };

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
          <h1 className="text-lg font-semibold text-[var(--g0b-text)]">수송선게임 · 테스트룸</h1>
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
      <div className="max-w-lg mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <button type="button" onClick={() => setSessionId('')} className="text-sm text-[var(--g0b-muted)]">
            ← 세션 변경
          </button>
          <span className="text-xs text-[var(--g0b-muted)]">{sessionId}</span>
        </header>

        <div className="flex gap-2 items-center">
          <label className="text-sm text-[var(--g0b-muted)]">플레이어</label>
          <select
            value={playerNum}
            onChange={(e) => setPlayerNum(Number(e.target.value))}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--g0b-surface)] border border-white/10"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}번
              </option>
            ))}
          </select>
        </div>

        {loading && !game && <p className="text-[var(--g0b-muted)]">로딩…</p>}

        {!loading && !game && (
          <p className="text-amber-400 text-sm">game_0b 없음. 진행자 화면에서 init 하세요.</p>
        )}

        {game && (
          <section className="rounded-2xl border border-[var(--g0b-accent)]/40 bg-[var(--g0b-surface)] p-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-[var(--g0b-muted)]">플레이어 {playerNum}</p>
              <p className="text-2xl font-bold mt-1">{role ?? '역할 미배정'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-[var(--g0b-muted)]">보유 코어</p>
              <p className="text-5xl font-black text-[var(--g0b-accent)]" style={{ fontFamily: 'var(--font-share-tech-mono)' }}>
                {core}
              </p>
            </div>
            <p className="text-xs text-center text-[var(--g0b-muted)]">
              카드 태그 연동은 이후 단계에서 추가합니다.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

export default function Game0bTestroomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0e14] text-slate-400 flex items-center justify-center">로딩…</div>}>
      <TestroomContent />
    </Suspense>
  );
}
