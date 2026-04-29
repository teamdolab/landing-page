'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame0b } from '@/lib/use-game-0b';
import { clampShipHull, type Game0bRow } from '@/lib/game-0b-types';
import '../../display/styles.css';
import '../display/susongseon-display.css';

export function phaseLabel(phase: string) {
  if (phase === 'setup') return '대기';
  if (phase === 'role_reveal') return '역할 확인';
  if (phase === 'day') return '낮';
  if (phase === 'night') return '밤';
  if (phase === 'morning') return '아침 브리핑';
  if (phase === 'result_reveal') return '결과 공개';
  return phase;
}

export function shipStatus(hull: number): { label: string; className: string } {
  const h = clampShipHull(hull);
  if (h > 50) return { label: '안전', className: 'ship-safe' };
  if (h > 0)  return { label: '위험', className: 'ship-danger' };
  return { label: '파괴', className: 'ship-destroy' };
}

function useCountdown(deadline: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };
    setRemaining(calc());
    const id = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return remaining;
}

function formatTimer(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type PageRole = 'display' | 'host' | 'testroom';

const PAGE_LABEL: Record<PageRole, string> = {
  display: '송출 화면',
  host: '진행자',
  testroom: '테스트룸',
};

type Props = {
  role: PageRole;
  children: (game: Game0bRow, reload: () => void) => ReactNode;
};

function GameLayoutInner({ role, children }: Props) {
  const searchParams = useSearchParams();
  const param = searchParams.get('session')?.trim() || '';
  const [sessionId, setSessionId] = useState(param);

  const { game, loading, reload } = useGame0b(sessionId || null);

  const row = game as Game0bRow | null;
  const timerSeconds = useCountdown(row?.phase_deadline_at ?? null);

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).session?.value?.trim();
    if (input) setSessionId(input);
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1
            className="text-2xl font-bold text-white mb-6 text-center"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            수송선게임 · {PAGE_LABEL[role]}
          </h1>
          <form onSubmit={handleSessionSubmit} className="space-y-4">
            <input
              name="session"
              type="text"
              placeholder="세션 ID (예: 260306A0B1)"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-gray-500 focus:border-[#FF4F00] focus:outline-none"
            />
            <button
              type="submit"
              className="w-full py-3 bg-[#FF4F00] hover:bg-[#e64800] text-white font-bold rounded-lg transition-colors"
            >
              입장
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500 text-center">
            게임 진행(컨트롤)에서 세션 ID를 확인하세요.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !game) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white animate-pulse">로딩 중...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
        <p className="text-gray-400 mb-4">해당 세션의 게임이 없습니다.</p>
        <button
          type="button"
          onClick={() => setSessionId('')}
          className="px-4 py-2 text-[#FF4F00] border border-[#FF4F00] rounded-lg hover:bg-[#FF4F00]/10"
        >
          세션 선택으로
        </button>
      </div>
    );
  }

  const gameRow = game as Game0bRow;
  const phaseText =
    role === 'display' && gameRow.phase === 'result_reveal'
      ? '게임 종료'
      : gameRow.info_text || phaseLabel(gameRow.phase);
  const timerExpired = timerSeconds != null && timerSeconds <= 0;
  const status = shipStatus(gameRow.ship_hull);

  return (
    <div className="game-display-root susongseon-display">
      <div className="scanlines" aria-hidden />

      {/* ── 상단바 ── */}
      <header className="display-header">
        <div className="brand-box">
          <span className="brand-main">DO:LAB</span>
          <span className="brand-sub">NEON PROJECT</span>
        </div>
        <div className="title-frame">
          <h1 className="game-title">수송선게임</h1>
        </div>
        <div className="round-box">{gameRow.current_round} ROUND</div>
      </header>

      <main className="display-main">
        {/* ── 중단: 게임 요약 정보 ── */}
        <section className="info-section">
          <div className="phase-container">
            <div className="phase-current">{phaseText}</div>
          </div>
          <div className="timer-wrapper">
            <div className="timer-container">
              <div className={`timer-value ${timerExpired ? 'timer-end' : ''}`}>
                {formatTimer(timerSeconds)}
              </div>
            </div>
          </div>
          <div className="ranking-container">
            {role === 'host' ? (
              <>
                <div className="ranking-header">수송선 게이지</div>
                <div className="host-hull-display">
                  <span className={`host-hull-value ${status.className}`}>{clampShipHull(gameRow.ship_hull)}%</span>
                  <span className={`host-hull-status ${status.className}`}>{status.label}</span>
                </div>
              </>
            ) : (
              <>
                <div className="ranking-header">수송선 기준</div>
                <ul className="ranking-list ship-rules-list">
                  <li className={`rank-item ship-rule-safe ${status.className === 'ship-safe' ? 'active' : ''}`}>
                    50% 초과 = 안전
                  </li>
                  <li className={`rank-item ship-rule-danger ${status.className === 'ship-danger' ? 'active' : ''}`}>
                    50% 이하 = 위험
                  </li>
                  <li className={`rank-item ship-rule-destroy ${status.className === 'ship-destroy' ? 'active' : ''}`}>
                    0% 이하 = 파괴
                  </li>
                </ul>
              </>
            )}
          </div>
        </section>

        {/* ── 하단: 페이지별 콘텐츠 ── */}
        <section className="bottom-section">{children(gameRow, reload)}</section>
      </main>
    </div>
  );
}

export default function GameLayout(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-white animate-pulse">로딩 중...</div>
        </div>
      }
    >
      <GameLayoutInner {...props} />
    </Suspense>
  );
}
