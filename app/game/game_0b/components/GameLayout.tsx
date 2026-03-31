'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame0b } from '@/lib/use-game-0b';
import type { Game0bRow } from '@/lib/game-0b-types';
import '../../display/styles.css';
import '../display/susongseon-display.css';

const SHIP_RULES: { text: string; tier: 's' | 'a' | 'b' | 'c' }[] = [
  { text: '50% 초과 · 안전(탈출 가능)', tier: 's' },
  { text: '50% 이하 · 위험(외계인 우세)', tier: 'a' },
  { text: '0% 이하 · 파괴(수리 필요)', tier: 'b' },
  { text: '라운드 종료 시 자연 부식', tier: 'c' },
];

export function phaseLabel(phase: string) {
  if (phase === 'setup') return '대기';
  if (phase === 'day') return '낮';
  if (phase === 'night') return '밤';
  if (phase === 'morning') return '아침 브리핑';
  return phase;
}

export function shipStatus(hull: number): { label: string; className: string } {
  if (hull > 50) return { label: '안전', className: 'ship-safe' };
  if (hull > 0) return { label: '위험', className: 'ship-danger' };
  return { label: '파괴', className: 'ship-destroy' };
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

  const row = game as Game0bRow;
  const phaseText = row.info_text || phaseLabel(row.phase);
  const shipDanger = row.ship_hull <= 50;

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
        <div className="round-box">{row.current_round} ROUND</div>
      </header>

      <main className="display-main">
        {/* ── 중단: 게임 요약 정보 ── */}
        <section className="info-section">
          <div className="phase-container">
            <div className="phase-current">{phaseText}</div>
          </div>
          <div className="timer-wrapper">
            <div className="timer-container">
              <div
                className={`timer-value ${shipDanger ? 'timer-end' : ''}`}
                style={{
                  fontSize: Math.abs(row.ship_hull) >= 100 ? 40 : 54,
                  letterSpacing: Math.abs(row.ship_hull) >= 100 ? 1 : 3,
                }}
              >
                {row.ship_hull}%
              </div>
            </div>
          </div>
          <div className="ranking-container">
            <div className="ranking-header">수송선 기준</div>
            <ul className="ranking-list">
              {SHIP_RULES.map((r) => (
                <li key={r.text} className={`rank-item ${r.tier}-tier`}>
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 하단: 페이지별 콘텐츠 ── */}
        <section className="bottom-section">{children(row, reload)}</section>
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
