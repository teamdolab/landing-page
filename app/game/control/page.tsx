'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Game0bRow } from '@/lib/game-0b-types';
import { isSessionGame0b } from '@/lib/session-game-kind';
import './control-styles.css';

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

type Session = {
  session_id: string;
  game_name: string;
  session_date: string;
  session_time: string;
  max_capacity: number;
  current_capacity: number;
  status: string;
};

type GamePlayer = {
  player_number: number;
  is_first: boolean;
  is_candidate: boolean;
  revealed_cards: string[];
  total_score: number;
  round_scores: number[];
};

type Game = {
  game_id: string;
  session_id: string;
  player_count: number;
  current_round: number;
  current_step: number;
  info_text: string | null;
  timer_seconds: number;
  timer_active: boolean;
  current_player: number | null;
  community_cards: string[];
  players: GamePlayer[];
  status: string;
};

export default function ControlPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [game0b, setGame0b] = useState<Game0bRow | null>(null);
  const [playerCount, setPlayerCount] = useState(8);
  const [creating, setCreating] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_STORAGE_KEY) === '1') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadSessions();
  }, [isAuthenticated]);

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

  async function loadSessions() {
    const res = await adminFetch('/api/admin/sessions');
    const data = await res.json();
    if (Array.isArray(data)) setSessions(data);
  }

  async function loadGameState(sessionId: string) {
    if (isSessionGame0b(sessionId)) {
      setGame(null);
      const res = await fetch(`/api/game/game_0b/session/${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (res.ok && data && data.game_id) {
        setGame0b(data as Game0bRow);
        if (typeof window !== 'undefined') {
          setDisplayUrl(`${window.location.origin}/game/game_0b/display?session=${encodeURIComponent(sessionId)}`);
        }
      } else {
        setGame0b(null);
        setDisplayUrl('');
      }
      return;
    }

    setGame0b(null);
    const res = await fetch(`/api/game/session/${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (res.ok && data) {
      setGame(data);
      if (typeof window !== 'undefined') {
        setDisplayUrl(`${window.location.origin}/game/display?session=${encodeURIComponent(sessionId)}`);
      }
    } else {
      setGame(null);
      setDisplayUrl('');
    }
  }

  async function selectSession(session: Session) {
    setSelectedSession(session);
    await loadGameState(session.session_id);
  }

  function handleGameStartClick() {
    if (!selectedSession) return;
    setConfirmOpen(true);
  }

  async function handleConfirmYes() {
    setConfirmOpen(false);
    if (!selectedSession) return;
    if (isSessionGame0b(selectedSession.session_id)) {
      await createGame0bAndNavigate();
    } else {
      await createGameAndNavigate();
    }
  }

  async function createGame0bAndNavigate() {
    if (!selectedSession) return;
    setCreating(true);
    try {
      const res = await fetch('/api/game/game_0b/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedSession.session_id }),
      });
      const data = await res.json();
      if (res.ok && data?.game_id) {
        setGame0b(data as Game0bRow);
        const sid = selectedSession.session_id;
        setDisplayUrl(`${window.location.origin}/game/game_0b/display?session=${encodeURIComponent(sid)}`);
        router.push(`/game/game_0b/host?session=${encodeURIComponent(sid)}`);
      } else {
        alert(data?.error || 'GAME 0B 생성 실패');
      }
    } catch (e) {
      console.error(e);
      alert('게임 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  }

  async function createGameAndNavigate() {
    if (!selectedSession) return;
    setCreating(true);
    try {
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSession.session_id,
          player_count: playerCount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame(data);
        setDisplayUrl(`${window.location.origin}/game/display?session=${encodeURIComponent(selectedSession.session_id)}`);
        router.push(`/game/control/${data.game_id}`);
      } else {
        alert(data.error || '게임 생성 실패');
      }
    } catch (e) {
      console.error(e);
      alert('게임 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="control-root">
        <div className="control-login-wrap">
          <div className="control-login-card">
            <h1 className="control-login-title">게임 진행</h1>
            <p className="control-login-sub">DO:LAB NEON PROJECT</p>
            <form onSubmit={handlePasswordSubmit} className="control-login-form">
              {authError && <p className="control-login-error">{authError}</p>}
              <input
                type="password"
                placeholder="비밀번호"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <button type="submit">로그인</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="control-root">
      <header className="control-header">
        <div className="control-brand">
          <span className="control-brand-main">DO:LAB</span>
          <span className="control-brand-sub">NEON PROJECT</span>
        </div>
        <h2 className="control-title">게임 진행</h2>
        <button
          className="control-logout"
          onClick={async () => {
            await fetch('/api/admin/login', { method: 'DELETE', credentials: 'include' });
            sessionStorage.removeItem(ADMIN_STORAGE_KEY);
            window.location.reload();
          }}
        >
          로그아웃
        </button>
      </header>

      <main className="control-main">
        {/* 게임 선택 카드 */}
        <div className="control-card">
          <h2 className="control-card-title">
            <i className="fa-solid fa-list" />
            게임 선택 ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <div className="control-empty">
              Admin 페이지에서 먼저 게임 세션을 생성해주세요.
            </div>
          ) : (
            <div className="control-session-list">
              {sessions.map((s) => (
                <div
                  key={s.session_id}
                  className={`control-session-card ${selectedSession?.session_id === s.session_id ? 'active' : ''}`}
                  onClick={() => selectSession(s)}
                >
                  <div className="control-session-header">
                    <span className="control-session-id">{s.session_id}</span>
                    <span className={`control-status-badge ${s.status === '모집중' ? 'open' : 'closed'}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="control-session-info">
                    <span><i className="fa-solid fa-gamepad" /> {s.game_name}</span>
                    <span><i className="fa-solid fa-calendar" /> {s.session_date} {s.session_time}</span>
                    <span><i className="fa-solid fa-users" /> {s.current_capacity} / {s.max_capacity}명</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 세션: 게임 생성 또는 진행 */}
        {selectedSession && (
          <div className="control-card">
            <h2 className="control-card-title">
              <i className="fa-solid fa-play" />
              {selectedSession.session_id} · {selectedSession.game_name}
            </h2>
            {!game && !game0b ? (
              <div className="control-create-section">
                {selectedSession && !isSessionGame0b(selectedSession.session_id) && (
                  <div className="control-form-group">
                    <label>플레이어 수 (8~12명)</label>
                    <select
                      value={playerCount}
                      onChange={(e) => setPlayerCount(Number(e.target.value))}
                    >
                      {[8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={n}>{n}명</option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedSession && isSessionGame0b(selectedSession.session_id) && (
                  <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
                    GAME 0B 세션입니다. 플레이어 수는 이후 단계에서 반영합니다.
                  </p>
                )}
                <button
                  className="control-btn-primary"
                  onClick={handleGameStartClick}
                  disabled={creating}
                >
                  {creating ? '생성 중...' : '게임 시작'}
                </button>
              </div>
            ) : game0b && selectedSession ? (
              <div className="control-create-section">
                <p style={{ color: '#2e7d32', fontWeight: 600, marginBottom: 12 }}>GAME 0B 진행 중</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link
                    href={`/game/game_0b/host?session=${encodeURIComponent(selectedSession.session_id)}`}
                    className="control-btn-primary"
                  >
                    <i className="fa-solid fa-gamepad" /> 진행자 화면
                  </Link>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn-secondary"
                  >
                    <i className="fa-solid fa-external-link-alt" /> 송출 화면 열기
                  </a>
                  <a
                    href={`/game/game_0b/testroom?session=${encodeURIComponent(selectedSession.session_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn-secondary"
                  >
                    <i className="fa-solid fa-door-open" /> 테스트룸
                  </a>
                </div>
              </div>
            ) : game ? (
              <div className="control-create-section">
                <p style={{ color: '#2e7d32', fontWeight: 600, marginBottom: 12 }}>게임 진행 중</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link
                    href={`/game/control/${game.game_id}`}
                    className="control-btn-primary"
                  >
                    <i className="fa-solid fa-gamepad" /> 게임 컨트롤
                  </Link>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn-secondary"
                  >
                    <i className="fa-solid fa-external-link-alt" /> 송출 화면 열기
                  </a>
                  <a
                    href={`/login?gameId=${game.game_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn-secondary"
                  >
                    <i className="fa-solid fa-id-card" /> 로그인 화면
                  </a>
                  <a
                    href={`/logout?gameId=${game.game_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn-secondary"
                  >
                    <i className="fa-solid fa-sign-out-alt" /> 로그아웃 화면
                  </a>
                  <button
                    type="button"
                    className="control-btn-secondary"
                    style={{ color: '#c62828' }}
                    onClick={async () => {
                      if (!confirm('게임을 초기화하시겠습니까? 플레이어 수를 다시 선택하고 새로 시작합니다.')) return;
                      try {
                        const res = await fetch(`/api/game/${game.game_id}/reset`, { method: 'POST' });
                        if (res.ok) {
                          setGame(null);
                          setDisplayUrl('');
                          alert('게임이 초기화되었습니다. 플레이어 수를 선택하고 게임을 시작하세요.');
                        } else {
                          const data = await res.json();
                          alert(data.error || '초기화 실패');
                        }
                      } catch (e) {
                        console.error(e);
                        alert('초기화 중 오류가 발생했습니다.');
                      }
                    }}
                  >
                    <i className="fa-solid fa-rotate-left" /> 게임 초기화
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 게임 시작 확인 팝업 */}
        {confirmOpen && selectedSession && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setConfirmOpen(false)}
          >
            <div
              style={{
                background: '#fff',
                padding: 32,
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                maxWidth: 400,
                width: '90%',
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, color: 'var(--text-dark)' }}>
                {selectedSession.session_id} 게임을 진행합니다.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  className="control-btn-primary"
                  style={{ flex: 1, maxWidth: 120 }}
                  onClick={handleConfirmYes}
                >
                  네
                </button>
                <button
                  className="control-btn-secondary"
                  style={{ flex: 1, maxWidth: 120 }}
                  onClick={() => setConfirmOpen(false)}
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
