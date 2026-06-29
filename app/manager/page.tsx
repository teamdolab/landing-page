'use client';

import { useState, useEffect, useCallback } from 'react';

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

type Station = {
  id: string;
  store_name: string;
  name: string;
  active_session_id: string | null;
  created_at: string;
};

type Session = {
  session_id: string;
  game_name: string;
  game_kind: string;
  session_date: string;
  session_time: string;
  status: string;
};

function getLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTodayLabel() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function isStationActive(station: Station) {
  return station.active_session_id != null && station.active_session_id.trim() !== '';
}

export default function ManagerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalStation, setModalStation] = useState<Station | null>(null);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_STORAGE_KEY) === '1') {
      setIsAuthenticated(true);
    }
  }, []);

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

  const loadAllSessions = useCallback(async () => {
    const map: Record<string, Session> = {};
    let page = 1;
    let total = Infinity;

    while ((page - 1) * 20 < total && page <= 50) {
      const res = await adminFetch(`/api/admin/sessions?page=${page}`);
      const data = await res.json();
      const batch: Session[] = Array.isArray(data.sessions) ? data.sessions : [];
      total = typeof data.total === 'number' ? data.total : batch.length;
      for (const s of batch) map[s.session_id] = s;
      if (batch.length === 0) break;
      page += 1;
    }

    return map;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [stationsRes, sessions] = await Promise.all([
        adminFetch('/api/admin/stations'),
        loadAllSessions(),
      ]);
      const stationsData = await stationsRes.json();
      setStations(Array.isArray(stationsData.stations) ? stationsData.stations : []);
      setSessionMap(sessions);
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') return;
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [loadAllSessions]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, loadData]);

  function getAssignedSessionIds(excludeStationId?: string) {
    return new Set(
      stations
        .filter((s) => s.id !== excludeStationId && isStationActive(s))
        .map((s) => s.active_session_id as string),
    );
  }

  async function openStartModal(station: Station) {
    setModalStation(station);
    setModalError('');
    setModalLoading(true);
    setTodaySessions([]);

    try {
      const sessions = await loadAllSessions();
      setSessionMap(sessions);

      const today = getLocalDateString();
      const assigned = getAssignedSessionIds(station.id);
      const available = Object.values(sessions).filter(
        (s) =>
          s.session_date === today &&
          (s.status === '모집중' || s.status === '진행중') &&
          !assigned.has(s.session_id),
      );
      available.sort((a, b) => a.session_time.localeCompare(b.session_time));
      setTodaySessions(available);
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') return;
      setModalError('세션 목록을 불러오지 못했습니다.');
    } finally {
      setModalLoading(false);
    }
  }

  async function startGame(station: Station, sessionId: string) {
    setActionLoading(station.id);
    try {
      const res = await adminFetch(`/api/admin/stations/${encodeURIComponent(station.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '게임 시작에 실패했습니다.');
        return;
      }
      setModalStation(null);
      await loadData();
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') return;
      alert('게임 시작 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  async function endGame(station: Station) {
    if (!confirm('정말 종료하시겠습니까?')) return;

    setActionLoading(station.id);
    try {
      const res = await adminFetch(`/api/admin/stations/${encodeURIComponent(station.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_session_id: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '게임 종료에 실패했습니다.');
        return;
      }
      await loadData();
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') return;
      alert('게임 종료 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  function openScreen(path: '/login' | '/logout') {
    window.open(path, '_blank', 'noopener,noreferrer');
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-xl font-bold">DO:LAB 매니저</h1>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="비밀번호"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
              className="min-h-12 rounded-lg border-2 border-orange-500 bg-transparent px-4 text-white placeholder:text-gray-500"
            />
            {authError && <p className="text-sm text-red-400">{authError}</p>}
            <button
              type="submit"
              className="min-h-12 rounded-lg bg-orange-600 font-semibold text-white hover:bg-orange-500"
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">DO:LAB 매니저</h1>
          <p className="text-sm text-gray-400 sm:text-base">{formatTodayLabel()}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        {loading ? (
          <p className="text-center text-gray-400 py-16">불러오는 중...</p>
        ) : error ? (
          <p className="text-center text-red-400 py-16">{error}</p>
        ) : stations.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-16 text-center">
            <p className="text-lg text-gray-300">등록된 팀 자리가 없습니다</p>
            <p className="mt-2 text-sm text-gray-500">관리자 페이지에서 팀 자리를 먼저 등록해 주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((station) => {
              const active = isStationActive(station);
              const session = active ? sessionMap[station.active_session_id!] : undefined;
              const busy = actionLoading === station.id;

              return (
                <article
                  key={station.id}
                  className="flex flex-col rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-400">{station.store_name}</p>
                      <h2 className="text-2xl font-bold">{station.name}</h2>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        active ? 'bg-green-600/20 text-green-400' : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {active ? '진행중' : '비어있음'}
                    </span>
                  </div>

                  <p className="mb-6 text-sm text-gray-300">
                    {active && session
                      ? session.game_kind
                      : active
                        ? station.active_session_id
                        : '켜진 게임 없음'}
                  </p>

                  <div className="mt-auto grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={active || busy}
                      onClick={() => openStartModal(station)}
                      className="min-h-12 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      게임 시작
                    </button>
                    <button
                      type="button"
                      disabled={!active || busy}
                      onClick={() => openScreen('/login')}
                      className="min-h-12 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      로그인 화면
                    </button>
                    <button
                      type="button"
                      disabled={!active || busy}
                      onClick={() => openScreen('/logout')}
                      className="min-h-12 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      로그아웃 화면
                    </button>
                    <button
                      type="button"
                      disabled={!active || busy}
                      onClick={() => endGame(station)}
                      className="min-h-12 rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      게임 종료
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {modalStation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => !modalLoading && setModalStation(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-600 bg-gray-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">
              {modalStation.name} — 게임 선택
            </h3>
            <p className="mt-1 text-sm text-gray-400">오늘({getLocalDateString()}) 모집중·진행중 세션</p>

            {modalLoading ? (
              <p className="py-10 text-center text-gray-400">세션 불러오는 중...</p>
            ) : modalError ? (
              <p className="py-10 text-center text-red-400">{modalError}</p>
            ) : todaySessions.length === 0 ? (
              <p className="py-10 text-center text-gray-400">선택 가능한 세션이 없습니다</p>
            ) : (
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                {todaySessions.map((session) => (
                  <li key={session.session_id}>
                    <button
                      type="button"
                      disabled={actionLoading === modalStation.id}
                      onClick={() => startGame(modalStation, session.session_id)}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-4 text-left transition hover:border-orange-500 hover:bg-gray-900/80 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{session.game_name}</span>
                        <span className="text-xs text-gray-400">{session.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">
                        {session.game_kind} · {session.session_time.slice(0, 5)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{session.session_id}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={modalLoading}
              onClick={() => setModalStation(null)}
              className="mt-6 min-h-12 w-full rounded-lg border border-gray-600 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
