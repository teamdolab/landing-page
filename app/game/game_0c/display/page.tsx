'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { game0cPhaseLabel, formatCountdown } from '@/lib/game-0c-display';
import type { Game0cBidResult, Game0cForceCandidate } from '@/lib/game-0c-types';
import { useGame0cPublic, useTimerCountdown } from '@/lib/use-game-0c-public';
import '../game-0c-display.css';

function parseForceCandidates(raw: unknown): Game0cForceCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const player = Number(o.player);
      const order = Number(o.order);
      if (!Number.isInteger(player) || !Number.isInteger(order)) return null;
      return { player, order };
    })
    .filter((x): x is Game0cForceCandidate => x != null)
    .sort((a, b) => a.order - b.order);
}

function parseBidResults(raw: unknown): Game0cBidResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const player = Number(o.player);
      const bids = Number(o.bids);
      if (!Number.isInteger(player) || !Number.isInteger(bids)) return null;
      return { player, bids };
    })
    .filter((x): x is Game0cBidResult => x != null)
    .sort((a, b) => a.player - b.player);
}

function DisplayContent() {
  const searchParams = useSearchParams();
  const paramSession = searchParams.get('session')?.trim() ?? '';
  const [sessionId, setSessionId] = useState(paramSession);

  const { publicData, loading } = useGame0cPublic(sessionId || null);
  const timerSeconds = useTimerCountdown(publicData?.timer_end);

  if (!sessionId) {
    return (
      <div className="game0c-display-empty">
        <h1>좀비게임 · 송출 화면</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).session?.value?.trim();
            if (input) setSessionId(input);
          }}
        >
          <input name="session" type="text" placeholder="세션 ID (예: 260306A0C1)" />
          <button type="submit">입장</button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
          URL에 ?session=세션ID 를 붙여 접속할 수도 있습니다.
        </p>
      </div>
    );
  }

  if (loading && !publicData) {
    return (
      <div className="game0c-display-empty">
        <p className="game0c-display-waiting">로딩 중...</p>
      </div>
    );
  }

  if (!publicData) {
    return (
      <div className="game0c-display-empty">
        <p className="game0c-display-waiting">게임 데이터가 없습니다.</p>
        <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>세션: {sessionId}</p>
        <button type="button" style={{ marginTop: 16 }} onClick={() => setSessionId('')}>
          세션 다시 선택
        </button>
      </div>
    );
  }

  const forceCandidates = parseForceCandidates(publicData.force_candidates);
  const bidResults = parseBidResults(publicData.bid_results);
  const currentRound = publicData.round ?? 0;
  const roundForcePairs = (publicData.force_pairs ?? []).filter((p) => p.round === currentRound);
  const showTimer = publicData.timer_end != null && timerSeconds != null;
  const timerLow = timerSeconds != null && timerSeconds <= 30;

  return (
    <div className="game0c-display-root">
      <div className="game0c-display-scanlines" aria-hidden />

      <header className="game0c-display-header">
        <div className="game0c-display-brand">
          <span className="game0c-display-brand-main">DO:LAB</span>
          <span className="game0c-display-brand-sub">NEON PROJECT</span>
        </div>
        <div className="game0c-display-title">좀비게임</div>
        <div className="game0c-display-meta">
          <span className="game0c-display-round">
            {currentRound > 0 ? `R${String(currentRound).padStart(2, '0')}` : '—'}
          </span>
          <span className="game0c-display-phase">{game0cPhaseLabel(publicData.phase)}</span>
        </div>
      </header>

      <main className="game0c-display-main">
        {showTimer && (
          <section className="game0c-display-timer">
            <div className={`game0c-display-timer-value ${timerLow ? 'is-low' : ''}`}>
              {formatCountdown(timerSeconds)}
            </div>
            <div className="game0c-display-timer-label">남은 시간</div>
          </section>
        )}

        <div className="game0c-display-sections">
          {(forceCandidates.length > 0 || roundForcePairs.length > 0) && (
            <section className="game0c-display-section">
              <h2>강제접촉</h2>
              {forceCandidates.length > 0 && (
                <div>
                  <ul className="game0c-display-list">
                    {forceCandidates.map((c) => (
                      <li key={`${c.player}-${c.order}`}>
                        {c.order}순위 · {c.player}번
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {roundForcePairs.length > 0 && (
                <div className="game0c-display-subsection">
                  <h3>이번 라운드 강제접촉</h3>
                  <ul className="game0c-display-list">
                    {roundForcePairs.map((p, i) => (
                      <li key={`${p.pair[0]}-${p.pair[1]}-${i}`} className="game0c-display-pair">
                        {p.pair[0]}번 → {p.pair[1]}번
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {bidResults.length > 0 && (
            <section className="game0c-display-section">
              <h2>입찰 결과</h2>
              <ul className="game0c-display-list">
                {bidResults.map((b) => (
                  <li key={b.player}>
                    플레이어 {b.player}번: 슬롯 {b.bids}개
                  </li>
                ))}
              </ul>
            </section>
          )}

          {forceCandidates.length === 0 && roundForcePairs.length === 0 && bidResults.length === 0 && !showTimer && (
            <p className="game0c-display-waiting">{game0cPhaseLabel(publicData.phase)}</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Game0cDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="game0c-display-empty">
          <p className="game0c-display-waiting">로딩 중...</p>
        </div>
      }
    >
      <DisplayContent />
    </Suspense>
  );
}
