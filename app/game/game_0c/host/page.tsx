'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCountdown } from '@/lib/game-0c-display';
import type {
  Game0cContactType,
  Game0cEventRow,
  Game0cForceCandidate,
  Game0cFinalResult,
  Game0cPhase,
  Game0cPlayer,
  Game0cPlayerState,
  Game0cPublicRow,
  Game0cSnapshotRow,
  Game0cVariationChoice,
} from '@/lib/game-0c-types';
import { useTimerCountdown } from '@/lib/use-game-0c-public';
import '../game-0c-host.css';

const ADMIN_STORAGE_KEY = 'admin_authenticated';

async function adminFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    window.location.reload();
    throw new Error('Unauthorized');
  }
  return res;
}

function parseForceCandidates(raw: unknown): Game0cForceCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const player = Number(o.player);
      if (!Number.isInteger(player)) return null;
      const order = o.order == null ? null : Number(o.order);
      if (order != null && !Number.isInteger(order)) return null;
      return { player, order };
    })
    .filter((x): x is Game0cForceCandidate => x != null);
}

function stateLabel(state: Game0cPlayerState): string {
  if (state === 'human') return '인간';
  if (state === 'doctor') return '의사';
  return '좀비';
}

function stateClass(state: Game0cPlayerState): string {
  if (state === 'human') return 'game0c-state-human';
  if (state === 'doctor') return 'game0c-state-doctor';
  return 'game0c-state-zombie';
}

function phaseLabel(phase: Game0cPhase | null): string {
  if (!phase) return '-';
  const map: Record<Game0cPhase, string> = {
    WAITING: '대기',
    ROUND_OPEN: '라운드 진행',
    BIDDING: '입찰',
    FORCE: '강제접촉',
    OPEN: '자유시간',
    CLOSED: '종료',
    FINISHED: '게임 종료',
  };
  return map[phase] ?? phase;
}

function eventSummary(ev: Game0cEventRow): string {
  const priv = ev.payload_private ?? {};
  const pub = ev.payload_public ?? {};
  if (ev.event_type === 'CONTACT_RESOLVE') {
    return `접촉 ${priv.a}↔${priv.b} (${priv.contact_type})`;
  }
  if (ev.event_type === 'VARIATION_RESOLVE') {
    return `변신 P${priv.player} → ${priv.choice}${priv.success ? '' : ' (probe)'}`;
  }
  if (ev.event_type === 'ROUND_OPEN') {
    return pub.phase === 'OPEN' ? `라운드 ${ev.round} 자유시간 시작` : `라운드 ${ev.round} 시작`;
  }
  if (ev.event_type === 'FORCE_CANDIDATES_SET') {
    return `강제접촉 후보 선정`;
  }
  if (ev.event_type === 'BID_SUBMIT') {
    return `입찰 P${priv.player}: ${priv.bids}슬롯`;
  }
  if (ev.event_type === 'BID_RESULT') {
    return `입찰 결과 확정`;
  }
  if (ev.event_type === 'ROUND_CLOSED') {
    return `라운드 ${ev.round} 종료`;
  }
  if (ev.event_type === 'GAME_FINALIZED') {
    const winners = Array.isArray(priv.winners) ? (priv.winners as number[]).join(', ') : '-';
    return `게임 종료 — 우승: ${winners}`;
  }
  if (ev.event_type === 'REVERT') {
    return `되돌림 #${priv.target_event_id}`;
  }
  return ev.event_type;
}

function HostPageInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session')?.trim() ?? '';

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [snapshot, setSnapshot] = useState<Game0cSnapshotRow | null>(null);
  const [publicData, setPublicData] = useState<Game0cPublicRow | null>(null);
  const [events, setEvents] = useState<Game0cEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');

  const [playerCount, setPlayerCount] = useState(12);
  const [initLoading, setInitLoading] = useState(false);

  const [contactA, setContactA] = useState(1);
  const [contactB, setContactB] = useState(2);
  const [contactLoading, setContactLoading] = useState(false);

  const [variationPlayer, setVariationPlayer] = useState(1);
  const [variationChoice, setVariationChoice] = useState<Game0cVariationChoice>('doctor');
  const [variationLoading, setVariationLoading] = useState(false);

  const [bidInputs, setBidInputs] = useState<Record<number, number>>({});
  const [bidSubmitting, setBidSubmitting] = useState<number | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [revertLoading, setRevertLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [finalResult, setFinalResult] = useState<Game0cFinalResult | null>(null);
  const [finalPanelOpen, setFinalPanelOpen] = useState(false);
  const [nominatedPlayer, setNominatedPlayer] = useState<number | null>(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [manualContactOpen, setManualContactOpen] = useState(false);

  const timerSeconds = useTimerCountdown(publicData?.timer_end);
  const playerOptions = snapshot?.players.map((p) => p.num) ?? [];
  const round = snapshot?.round ?? 0;
  const phase = snapshot?.phase ?? null;

  const forceCandidates = useMemo(
    () => parseForceCandidates(publicData?.force_candidates),
    [publicData?.force_candidates],
  );

  const orderedForceCandidates = useMemo(
    () => [...forceCandidates].filter((c) => c.order != null).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [forceCandidates],
  );

  const completedForceCount = useMemo(() => {
    if (!publicData) return 0;
    return (publicData.force_pairs ?? []).filter((p) => p.round === round).length;
  }, [publicData, round]);

  const nextForcePlayer = orderedForceCandidates[completedForceCount]?.player ?? null;

  useEffect(() => {
    if (nextForcePlayer != null) {
      setContactA(nextForcePlayer);
    }
  }, [nextForcePlayer]);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_STORAGE_KEY) === '1') {
      setIsAuthenticated(true);
    }
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMsg(text);
    setMsgType(type);
  };

  const reload = useCallback(async () => {
    if (!sessionId || !isAuthenticated) return;
    try {
      const [snapRes, evRes] = await Promise.all([
        adminFetch(`/api/game/game_0c/snapshot?session_id=${encodeURIComponent(sessionId)}`),
        adminFetch(`/api/game/game_0c/events?session_id=${encodeURIComponent(sessionId)}`),
      ]);
      const snapJson = await snapRes.json();
      const evJson = await evRes.json();
      if (snapRes.ok) {
        setSnapshot(snapJson.snapshot ?? null);
        setPublicData(snapJson.public ?? null);
      }
      if (evRes.ok) {
        setEvents(evJson.events ?? []);
      }
    } catch {
      /* 401 reload */
    }
  }, [sessionId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [isAuthenticated, sessionId, reload]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;
    const poll = setInterval(reload, 3000);
    return () => clearInterval(poll);
  }, [isAuthenticated, sessionId, reload]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
        credentials: 'include',
      });
      if (res.ok) {
        sessionStorage.setItem(ADMIN_STORAGE_KEY, '1');
        setIsAuthenticated(true);
        setPasswordInput('');
      } else {
        setAuthError('비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setAuthError('로그인에 실패했습니다.');
    }
  }

  async function postAdmin(path: string, body: Record<string, unknown>) {
    const res = await adminFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || '요청 실패');
    return j;
  }

  async function handleInitGame() {
    setInitLoading(true);
    setMsg(null);
    try {
      await postAdmin('/api/game/game_0c/init-game', {
        session_id: sessionId,
        player_count: playerCount,
      });
      showMsg(`게임 초기화 완료 (${playerCount}인)`, 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '초기화 실패', 'error');
    } finally {
      setInitLoading(false);
    }
  }

  async function handleStartRound() {
    if (!snapshot) return;
    const nextRound = (snapshot.round ?? 0) === 0 ? 1 : (snapshot.round ?? 0) + 1;
    setActionLoading(true);
    setMsg(null);
    try {
      await postAdmin('/api/game/game_0c/init-round', {
        session_id: sessionId,
        round: nextRound,
      });
      showMsg(`라운드 ${nextRound} 시작`, 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '라운드 시작 실패', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartBidding() {
    setActionLoading(true);
    try {
      await postAdmin('/api/game/game_0c/start-bidding', { session_id: sessionId, round });
      showMsg('입찰 시작', 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '입찰 시작 실패', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCloseBidding() {
    setActionLoading(true);
    try {
      await postAdmin('/api/game/game_0c/close-bidding', { session_id: sessionId, round });
      showMsg('입찰 종료 — 강제접촉 단계', 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '입찰 종료 실패', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCloseForce() {
    setActionLoading(true);
    try {
      await postAdmin('/api/game/game_0c/close-force', { session_id: sessionId, round });
      showMsg('자유시간 시작', 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '자유시간 시작 실패', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCloseRound() {
    setActionLoading(true);
    try {
      await postAdmin('/api/game/game_0c/close-round', { session_id: sessionId, round });
      showMsg('라운드 종료', 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '라운드 종료 실패', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitBid(player: number) {
    const bids = bidInputs[player] ?? 0;
    setBidSubmitting(player);
    try {
      await postAdmin('/api/game/game_0c/submit-bid', {
        session_id: sessionId,
        round,
        player,
        bids,
      });
      showMsg(`플레이어 ${player} 입찰 제출 (${bids}슬롯)`, 'success');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '입찰 실패', 'error');
    } finally {
      setBidSubmitting(null);
    }
  }

  async function handleLoadFinalResult() {
    setFinalLoading(true);
    setMsg(null);
    try {
      const res = await adminFetch(
        `/api/game/game_0c/final-result?session_id=${encodeURIComponent(sessionId)}`,
      );
      const j = (await res.json()) as Game0cFinalResult & { error?: string };
      if (!res.ok) {
        throw new Error(j.error || '최종 결과 조회 실패');
      }
      setFinalResult(j);
      setFinalPanelOpen(true);
      if (j.result === 'sole_winner' && j.eligible.length > 0) {
        setNominatedPlayer(j.eligible[0]);
      } else {
        setNominatedPlayer(null);
      }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '최종 결과 조회 실패', 'error');
    } finally {
      setFinalLoading(false);
    }
  }

  async function handleFinalize() {
    setFinalizeLoading(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { session_id: sessionId };
      if (finalResult?.result === 'sole_winner') {
        if (nominatedPlayer == null) {
          showMsg('지목 대상을 선택해주세요', 'error');
          return;
        }
        body.nominated_player = nominatedPlayer;
      }
      await postAdmin('/api/game/game_0c/finalize', body);
      showMsg('게임 종료 — 최종 결과가 확정되었습니다', 'success');
      setFinalPanelOpen(false);
      setFinalResult(null);
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '결과 확정 실패', 'error');
    } finally {
      setFinalizeLoading(false);
    }
  }

  async function handleContact(contactType: Game0cContactType) {
    if (!snapshot) return;
    if (contactA === contactB) {
      showMsg('서로 다른 플레이어를 선택하세요', 'error');
      return;
    }
    setContactLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0c/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          round,
          player_a: contactA,
          player_b: contactB,
          contact_type: contactType,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showMsg(j.error || '접촉 처리 실패', 'error');
      } else {
        showMsg(`접촉 완료 (이벤트 #${j.event_id})`, 'success');
        await reload();
      }
    } catch {
      showMsg('네트워크 오류', 'error');
    } finally {
      setContactLoading(false);
    }
  }

  async function handleVariation() {
    if (!snapshot) return;
    setVariationLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0c/variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          round,
          player: variationPlayer,
          choice: variationChoice,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showMsg(j.error || '변신 처리 실패', 'error');
      } else if (j.success_variation === false) {
        const probed = j.probed_state as Game0cPlayerState;
        showMsg(
          `변신 실패 (probe) — 플레이어 ${variationPlayer} 현재 상태: ${stateLabel(probed)}`,
          'info',
        );
        await reload();
      } else {
        showMsg(`변신 완료: 플레이어 ${variationPlayer} → ${stateLabel(variationChoice)}`, 'success');
        await reload();
      }
    } catch {
      showMsg('네트워크 오류', 'error');
    } finally {
      setVariationLoading(false);
    }
  }

  async function handleRevert() {
    if (!selectedEventId || !revertReason.trim()) {
      showMsg('이벤트 선택 및 사유 입력 필요', 'error');
      return;
    }
    setRevertLoading(true);
    try {
      await postAdmin('/api/game/game_0c/revert', {
        session_id: sessionId,
        target_event_id: selectedEventId,
        reason: revertReason.trim(),
      });
      showMsg(`이벤트 #${selectedEventId} 되돌림 완료`, 'success');
      setSelectedEventId(null);
      setRevertReason('');
      await reload();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '되돌리기 실패', 'error');
    } finally {
      setRevertLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="game0c-host-root">
        <div className="game0c-host-login">
          <div className="game0c-host-login-box">
            <h1>좀비게임 · 운영자 로그인</h1>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                placeholder="관리자 비밀번호"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              <button type="submit">입장</button>
            </form>
            {authError && <p className="game0c-host-error">{authError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="game0c-host-root">
        <div className="game0c-host-login">
          <div className="game0c-host-login-box">
            <h1>세션 ID 필요</h1>
            <p style={{ color: '#888', fontSize: 14, textAlign: 'center' }}>
              URL에 ?session=세션ID 를 붙여 접속하세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canStartRound =
    phase === 'WAITING' || (phase === 'CLOSED' && round > 0 && round < 6);
  const showFinalResultAction = phase === 'CLOSED' && round === 6;
  const isGameFinished = phase === 'FINISHED';
  const showTimer = publicData?.timer_end != null && timerSeconds != null;

  return (
    <div className="game0c-host-root">
      <header className="game0c-host-header">
        <div>
          <div className="game0c-host-title">좀비게임 · 운영자</div>
          <div className="game0c-host-session">{sessionId}</div>
        </div>
        <div className="game0c-host-meta">
          {snapshot && (
            <>
              <span className="game0c-host-badge">라운드 {round}</span>
              <span className="game0c-host-badge">{phaseLabel(phase)}</span>
              {showTimer && (
                <span className="game0c-host-badge game0c-host-timer">
                  ⏱ {formatCountdown(timerSeconds)}
                </span>
              )}
            </>
          )}
          <button
            type="button"
            className="game0c-host-logout"
            onClick={() => {
              sessionStorage.removeItem(ADMIN_STORAGE_KEY);
              fetch('/api/admin/login', { method: 'DELETE', credentials: 'include' });
              setIsAuthenticated(false);
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="game0c-host-main">
        {loading && !snapshot && <p style={{ color: '#888' }}>로딩 중...</p>}

        {!snapshot && !loading && (
          <section className="game0c-host-panel game0c-host-init-box">
            <h2>게임 초기화</h2>
            <div className="game0c-host-form-row">
              <div className="game0c-host-field">
                <label>플레이어 수 (8~12)</label>
                <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => i + 8).map((n) => (
                    <option key={n} value={n}>{n}인</option>
                  ))}
                </select>
              </div>
              <button type="button" className="game0c-host-btn" disabled={initLoading} onClick={handleInitGame}>
                {initLoading ? '처리 중...' : '게임 초기화'}
              </button>
            </div>
          </section>
        )}

        {snapshot && (
          <>
            <section className="game0c-host-panel">
              <h2>라운드 진행</h2>
              <div className="game0c-host-form-row">
                {canStartRound && (
                  <button
                    type="button"
                    className="game0c-host-btn"
                    disabled={actionLoading}
                    onClick={handleStartRound}
                  >
                    {actionLoading ? '처리 중...' : '라운드 시작'}
                  </button>
                )}
                {phase === 'ROUND_OPEN' && round >= 2 && (
                  <button
                    type="button"
                    className="game0c-host-btn"
                    disabled={actionLoading}
                    onClick={handleStartBidding}
                  >
                    입찰 시작
                  </button>
                )}
                {phase === 'ROUND_OPEN' && round === 1 && (
                  <button
                    type="button"
                    className="game0c-host-btn"
                    disabled={actionLoading}
                    onClick={handleCloseForce}
                  >
                    자유시간 시작
                  </button>
                )}
                {phase === 'BIDDING' && (
                  <button
                    type="button"
                    className="game0c-host-btn game0c-host-btn-secondary"
                    disabled={actionLoading}
                    onClick={handleCloseBidding}
                  >
                    입찰 종료
                  </button>
                )}
                {phase === 'FORCE' && (
                  <button
                    type="button"
                    className="game0c-host-btn game0c-host-btn-secondary"
                    disabled={actionLoading}
                    onClick={handleCloseForce}
                  >
                    강제접촉 종료
                  </button>
                )}
                {phase === 'OPEN' && (
                  <button
                    type="button"
                    className="game0c-host-btn game0c-host-btn-danger"
                    disabled={actionLoading}
                    onClick={handleCloseRound}
                  >
                    라운드 종료
                  </button>
                )}
                {showFinalResultAction && !finalPanelOpen && (
                  <button
                    type="button"
                    className="game0c-host-btn"
                    disabled={finalLoading}
                    onClick={handleLoadFinalResult}
                  >
                    {finalLoading ? '조회 중...' : '최종 결과 확인'}
                  </button>
                )}
              </div>
            </section>

            {showFinalResultAction && finalPanelOpen && finalResult && (
              <section className="game0c-host-panel game0c-host-final-panel">
                <h2>최종 결과</h2>
                {finalResult.result === 'no_winner' && (
                  <p className="game0c-host-final-msg">인간 생존자 없음 — 우승자 없습니다</p>
                )}
                {finalResult.result === 'co_winner' && (
                  <p className="game0c-host-final-msg">
                    공동 우승: {finalResult.winners.map((n) => `${n}번`).join(', ')}
                  </p>
                )}
                {finalResult.result === 'sole_winner' && (
                  <>
                    <p className="game0c-host-final-msg">
                      단독 우승: {finalResult.winner}번 — 지목 대상을 선택하세요
                    </p>
                    <div className="game0c-host-form-row">
                      <div className="game0c-host-field">
                        <label>지목 대상 (인간)</label>
                        <select
                          value={nominatedPlayer ?? ''}
                          onChange={(e) => setNominatedPlayer(Number(e.target.value))}
                        >
                          {finalResult.eligible.map((n) => (
                            <option key={n} value={n}>#{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  className="game0c-host-btn"
                  disabled={finalizeLoading}
                  onClick={handleFinalize}
                >
                  {finalizeLoading ? '처리 중...' : '결과 확정'}
                </button>
              </section>
            )}

            {isGameFinished && (
              <section className="game0c-host-panel game0c-host-final-panel">
                <h2>게임 종료</h2>
                <p className="game0c-host-final-msg">6라운드가 종료되었습니다. 최종 결과가 확정되었습니다.</p>
              </section>
            )}

            <section className="game0c-host-panel">
              <h2>플레이어 상태</h2>
              <PlayerTable players={snapshot.players} />
            </section>

            {phase === 'BIDDING' && (
              <section className="game0c-host-panel">
                <h2>입찰 (후보만 제출 가능)</h2>
                <ul className="game0c-host-bid-list">
                  {forceCandidates.map((c) => (
                    <li key={c.player} className="game0c-host-bid-item">
                      <span>후보 #{c.player}</span>
                      <select
                        value={bidInputs[c.player] ?? 0}
                        onChange={(e) => setBidInputs((prev) => ({
                          ...prev,
                          [c.player]: Number(e.target.value),
                        }))}
                      >
                        <option value={0}>0슬롯</option>
                        <option value={1}>1슬롯</option>
                        <option value={2}>2슬롯</option>
                      </select>
                      <button
                        type="button"
                        className="game0c-host-btn"
                        disabled={bidSubmitting === c.player}
                        onClick={() => handleSubmitBid(c.player)}
                      >
                        {bidSubmitting === c.player ? '...' : '제출'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(phase === 'FORCE' || phase === 'OPEN') && (
              <section className="game0c-host-panel">
                <button
                  type="button"
                  className="game0c-host-btn game0c-host-btn-secondary"
                  style={{ width: '100%', marginBottom: manualContactOpen ? 12 : 0 }}
                  onClick={() => setManualContactOpen((v) => !v)}
                >
                  비상 수동 입력 {manualContactOpen ? '▲' : '▼'}
                </button>
                {manualContactOpen && phase === 'FORCE' && (
                  <>
                    <h2 style={{ marginTop: 12 }}>강제접촉 입력</h2>
                    {nextForcePlayer != null && (
                      <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                        현재 순서: {completedForceCount + 1}번째 — 실행자 #{nextForcePlayer}
                      </p>
                    )}
                    <div className="game0c-host-form-row">
                      <div className="game0c-host-field">
                        <label>실행자 (후보)</label>
                        <select value={contactA} onChange={(e) => setContactA(Number(e.target.value))}>
                          {orderedForceCandidates.map((c) => (
                            <option key={c.player} value={c.player}>
                              {c.order}순위 · #{c.player}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="game0c-host-field">
                        <label>대상 플레이어</label>
                        <select value={contactB} onChange={(e) => setContactB(Number(e.target.value))}>
                          {playerOptions.filter((n) => n !== contactA).map((n) => (
                            <option key={n} value={n}>#{n}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="game0c-host-btn"
                        disabled={contactLoading}
                        onClick={() => handleContact('force')}
                      >
                        {contactLoading ? '처리 중...' : '강제접촉 실행'}
                      </button>
                    </div>
                  </>
                )}
                {manualContactOpen && phase === 'OPEN' && (
                  <>
                    <h2 style={{ marginTop: 12 }}>접촉 입력 (일반)</h2>
                    <div className="game0c-host-form-row">
                      <div className="game0c-host-field">
                        <label>플레이어 A</label>
                        <select value={contactA} onChange={(e) => setContactA(Number(e.target.value))}>
                          {playerOptions.map((n) => (
                            <option key={n} value={n}>#{n}</option>
                          ))}
                        </select>
                      </div>
                      <div className="game0c-host-field">
                        <label>플레이어 B</label>
                        <select value={contactB} onChange={(e) => setContactB(Number(e.target.value))}>
                          {playerOptions.map((n) => (
                            <option key={n} value={n}>#{n}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="game0c-host-btn"
                        disabled={contactLoading}
                        onClick={() => handleContact('normal')}
                      >
                        {contactLoading ? '처리 중...' : '접촉 실행'}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {phase === 'OPEN' && (
              <section className="game0c-host-panel">
                <h2>변신 입력</h2>
                <div className="game0c-host-form-row">
                  <div className="game0c-host-field">
                    <label>플레이어</label>
                    <select
                      value={variationPlayer}
                      onChange={(e) => setVariationPlayer(Number(e.target.value))}
                    >
                      {playerOptions.map((n) => (
                        <option key={n} value={n}>#{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="game0c-host-field">
                    <label>변신 선택</label>
                    <select
                      value={variationChoice}
                      onChange={(e) => setVariationChoice(e.target.value as Game0cVariationChoice)}
                    >
                      <option value="doctor">의사</option>
                      <option value="zombie">좀비</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="game0c-host-btn"
                    disabled={variationLoading}
                    onClick={handleVariation}
                  >
                    {variationLoading ? '처리 중...' : '변신 실행'}
                  </button>
                </div>
              </section>
            )}

            <section className="game0c-host-panel">
              <h2>되돌리기 (최근 이벤트 10개)</h2>
              <ul className="game0c-host-events">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className={`game0c-host-event-item ${selectedEventId === ev.id ? 'selected' : ''} ${ev.is_reverted ? 'reverted' : ''}`}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: ev.is_reverted || ev.event_type === 'REVERT' ? 'not-allowed' : 'pointer',
                      }}
                      disabled={ev.is_reverted || ev.event_type === 'REVERT'}
                      onClick={() => setSelectedEventId(ev.id)}
                    >
                      <span>
                        <strong>#{ev.id}</strong> {eventSummary(ev)}
                        {ev.is_reverted && ' [되돌림됨]'}
                      </span>
                      <span className="game0c-host-event-meta">
                        R{ev.round} · {new Date(ev.created_at).toLocaleTimeString('ko-KR')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="game0c-host-form-row" style={{ marginTop: 12 }}>
                <div className="game0c-host-field" style={{ flex: 1 }}>
                  <label>되돌리기 사유</label>
                  <input
                    type="text"
                    value={revertReason}
                    onChange={(e) => setRevertReason(e.target.value)}
                    placeholder="사유 입력"
                  />
                </div>
                <button
                  type="button"
                  className="game0c-host-btn game0c-host-btn-danger"
                  disabled={revertLoading || !selectedEventId}
                  onClick={handleRevert}
                >
                  {revertLoading ? '처리 중...' : '되돌리기'}
                </button>
              </div>
            </section>
          </>
        )}

        {msg && <p className={`game0c-host-msg ${msgType}`}>{msg}</p>}
      </main>
    </div>
  );
}

function PlayerTable({ players }: { players: Game0cPlayer[] }) {
  return (
    <table className="game0c-host-table">
      <thead>
        <tr>
          <th>번호</th>
          <th>상태</th>
          <th>점수</th>
          <th>슬롯 잔여</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.num}>
            <td>#{p.num}</td>
            <td className={stateClass(p.state)}>{stateLabel(p.state)}</td>
            <td>{p.score}</td>
            <td>{p.slots_left} / 3</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Game0cHostPage() {
  return (
    <Suspense
      fallback={
        <div className="game0c-host-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <span style={{ color: '#888' }}>로딩 중...</span>
        </div>
      }
    >
      <HostPageInner />
    </Suspense>
  );
}
