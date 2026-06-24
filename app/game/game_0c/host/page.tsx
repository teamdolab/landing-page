'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  Game0cContactType,
  Game0cEventRow,
  Game0cPhase,
  Game0cPlayer,
  Game0cPlayerState,
  Game0cSnapshotRow,
  Game0cVariationChoice,
} from '@/lib/game-0c-types';
import './game-0c-host.css';

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
    OPEN: '공개',
    CLOSED: '종료',
  };
  return map[phase] ?? phase;
}

function eventSummary(ev: Game0cEventRow): string {
  const priv = ev.payload_private ?? {};
  if (ev.event_type === 'CONTACT_RESOLVE') {
    return `접촉 ${priv.a}↔${priv.b} (${priv.contact_type})`;
  }
  if (ev.event_type === 'VARIATION_RESOLVE') {
    return `변신 P${priv.player} → ${priv.choice}${priv.success ? '' : ' (probe)'}`;
  }
  if (ev.event_type === 'ROUND_OPEN') {
    return `라운드 ${ev.round} 시작`;
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
  const [events, setEvents] = useState<Game0cEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');

  const [playerCount, setPlayerCount] = useState(12);
  const [initLoading, setInitLoading] = useState(false);

  const [contactA, setContactA] = useState(1);
  const [contactB, setContactB] = useState(2);
  const [contactType, setContactType] = useState<Game0cContactType>('normal');
  const [contactLoading, setContactLoading] = useState(false);

  const [variationPlayer, setVariationPlayer] = useState(1);
  const [variationChoice, setVariationChoice] = useState<Game0cVariationChoice>('doctor');
  const [variationLoading, setVariationLoading] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [revertLoading, setRevertLoading] = useState(false);
  const [roundLoading, setRoundLoading] = useState(false);

  const playerOptions = snapshot?.players.map((p) => p.num) ?? [];

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_STORAGE_KEY) === '1') {
      setIsAuthenticated(true);
    }
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMsg(text);
    setMsgType(type);
  };

  const loadSnapshot = useCallback(async () => {
    if (!sessionId || !isAuthenticated) return;
    try {
      const res = await adminFetch(
        `/api/game/game_0c/snapshot?session_id=${encodeURIComponent(sessionId)}`,
      );
      const j = await res.json();
      if (!res.ok) {
        showMsg(j.error || '스냅샷 조회 실패', 'error');
        return;
      }
      setSnapshot(j.snapshot ?? null);
    } catch {
      /* reload on 401 */
    }
  }, [sessionId, isAuthenticated]);

  const loadEvents = useCallback(async () => {
    if (!sessionId || !isAuthenticated) return;
    try {
      const res = await adminFetch(
        `/api/game/game_0c/events?session_id=${encodeURIComponent(sessionId)}`,
      );
      const j = await res.json();
      if (res.ok) {
        setEvents(j.events ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [sessionId, isAuthenticated]);

  const reload = useCallback(async () => {
    await Promise.all([loadSnapshot(), loadEvents()]);
  }, [loadSnapshot, loadEvents]);

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

  async function handleInitGame() {
    setInitLoading(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/game/game_0c/init-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, player_count: playerCount }),
      });
      const j = await res.json();
      if (!res.ok) {
        showMsg(j.error || '초기화 실패', 'error');
      } else {
        showMsg(`게임 초기화 완료 (${playerCount}인)`, 'success');
        await reload();
      }
    } catch {
      showMsg('네트워크 오류', 'error');
    } finally {
      setInitLoading(false);
    }
  }

  async function handleStartRound() {
    if (!snapshot) return;
    const nextRound = (snapshot.round ?? 0) === 0 ? 1 : (snapshot.round ?? 0) + 1;
    setRoundLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0c/init-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, round: nextRound }),
      });
      const j = await res.json();
      if (!res.ok) {
        showMsg(j.error || '라운드 시작 실패', 'error');
      } else {
        showMsg(`라운드 ${nextRound} 시작`, 'success');
        await reload();
      }
    } catch {
      showMsg('네트워크 오류', 'error');
    } finally {
      setRoundLoading(false);
    }
  }

  async function handleContact() {
    if (!snapshot) return;
    if (contactA === contactB) {
      showMsg('서로 다른 플레이어를 선택하세요', 'error');
      return;
    }
    const round = snapshot.round ?? 1;
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
        if (j.snapshot) setSnapshot(j.snapshot);
        await loadEvents();
      }
    } catch {
      showMsg('네트워크 오류', 'error');
    } finally {
      setContactLoading(false);
    }
  }

  async function handleVariation() {
    if (!snapshot) return;
    const round = snapshot.round ?? 1;
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
        if (j.snapshot) setSnapshot(j.snapshot);
        await loadEvents();
      } else {
        showMsg(`변신 완료: 플레이어 ${variationPlayer} → ${stateLabel(variationChoice)}`, 'success');
        if (j.snapshot) setSnapshot(j.snapshot);
        await loadEvents();
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
    setMsg(null);
    try {
      const res = await adminFetch('/api/game/game_0c/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          target_event_id: selectedEventId,
          reason: revertReason.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showMsg(j.error || '되돌리기 실패', 'error');
      } else {
        showMsg(`이벤트 #${selectedEventId} 되돌림 완료`, 'success');
        setSelectedEventId(null);
        setRevertReason('');
        if (j.snapshot) setSnapshot(j.snapshot);
        await loadEvents();
      }
    } catch {
      showMsg('네트워크 오류', 'error');
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

  const canStartRound = snapshot && snapshot.phase !== 'ROUND_OPEN';

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
              <span className="game0c-host-badge">라운드 {snapshot.round ?? 0}</span>
              <span className="game0c-host-badge">{phaseLabel(snapshot.phase)}</span>
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
            <p style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>
              이 세션의 게임 데이터가 없습니다. 플레이어 수를 선택하고 초기화하세요.
            </p>
            <div className="game0c-host-form-row">
              <div className="game0c-host-field">
                <label>플레이어 수 (8~12)</label>
                <select
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Number(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => i + 8).map((n) => (
                    <option key={n} value={n}>{n}인</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="game0c-host-btn"
                disabled={initLoading}
                onClick={handleInitGame}
              >
                {initLoading ? '처리 중...' : '게임 초기화'}
              </button>
            </div>
          </section>
        )}

        {snapshot && (
          <>
            <section className="game0c-host-panel">
              <h2>라운드 진행</h2>
              <button
                type="button"
                className="game0c-host-btn"
                disabled={!canStartRound || roundLoading}
                onClick={handleStartRound}
              >
                {roundLoading ? '처리 중...' : '라운드 시작'}
              </button>
              {snapshot.phase === 'ROUND_OPEN' && (
                <span style={{ marginLeft: 12, fontSize: 13, color: '#888' }}>
                  라운드 진행 중 — 종료 후 다음 라운드를 시작하세요
                </span>
              )}
            </section>

            <section className="game0c-host-panel">
              <h2>플레이어 상태</h2>
              <PlayerTable players={snapshot.players} />
            </section>

            <section className="game0c-host-panel">
              <h2>접촉 입력</h2>
              <div className="game0c-host-form-row">
                <div className="game0c-host-field">
                  <label>플레이어 A (실행자)</label>
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
                <div className="game0c-host-field">
                  <label>접촉 타입</label>
                  <select
                    value={contactType}
                    onChange={(e) => setContactType(e.target.value as Game0cContactType)}
                  >
                    <option value="normal">일반</option>
                    <option value="force">강제</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="game0c-host-btn"
                  disabled={contactLoading || snapshot.phase !== 'ROUND_OPEN'}
                  onClick={handleContact}
                >
                  {contactLoading ? '처리 중...' : '접촉 실행'}
                </button>
              </div>
            </section>

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
                  disabled={variationLoading || snapshot.phase !== 'ROUND_OPEN'}
                  onClick={handleVariation}
                >
                  {variationLoading ? '처리 중...' : '변신 실행'}
                </button>
              </div>
            </section>

            <section className="game0c-host-panel">
              <h2>되돌리기 (최근 이벤트 10개)</h2>
              <ul className="game0c-host-events">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className={`game0c-host-event-item ${selectedEventId === ev.id ? 'selected' : ''} ${ev.is_reverted ? 'reverted' : ''}`}
                      style={{ width: '100%', textAlign: 'left', cursor: ev.is_reverted || ev.event_type === 'REVERT' ? 'not-allowed' : 'pointer' }}
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
                {events.length === 0 && (
                  <li style={{ color: '#666', fontSize: 14 }}>이벤트 없음</li>
                )}
              </ul>
              <div className="game0c-host-form-row" style={{ marginTop: 12 }}>
                <div className="game0c-host-field" style={{ flex: 1 }}>
                  <label>되돌리기 사유</label>
                  <input
                    type="text"
                    value={revertReason}
                    onChange={(e) => setRevertReason(e.target.value)}
                    placeholder="사유 입력"
                    style={{ minWidth: 200 }}
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

        {msg && (
          <p className={`game0c-host-msg ${msgType}`}>{msg}</p>
        )}
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
