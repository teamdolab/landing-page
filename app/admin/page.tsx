'use client';

import { useState, useEffect, useCallback } from 'react';
import './admin-styles.css';

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
  game_kind: string;
  session_date: string;
  session_time: string;
  max_capacity: number;
  current_capacity: number;
  base_price: number;
  status: string;
  created_at: string;
  deleted_at: string | null;
};

type ApplyInfo = {
  id: string;
  user_name: string;
  phone: string;
  used_credits: number;
  final_price: number;
  status: string;
  deposit_confirmed: boolean;
};

type MasterRow = {
  code: string;
  name: string;
  game_kind?: string;
  active: boolean;
};

type Masters = {
  stores: MasterRow[];
  seasons: MasterRow[];
  game_types: MasterRow[];
};

type SettlementRow = {
  session_id: string;
  game_name: string;
  session_date: string;
  session_time: string;
  deleted: boolean;
  apply_count: number;
  confirmed_count: number;
  revenue: number;
  credits_used: number;
};

type SettlementTotal = {
  apply_count: number;
  confirmed_count: number;
  revenue: number;
  credits_used: number;
};

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

type Station = {
  id: string;
  store_name: string;
  name: string;
  active_session_id: string | null;
  created_at: string;
};

type Tab = 'sessions' | 'settlement' | 'masters' | 'logs';

const TAB_LABELS: Record<Tab, string> = {
  sessions: '세션 관리',
  settlement: '정산',
  masters: '마스터 관리',
  logs: '활동 로그',
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<Tab>('sessions');

  // 세션 관리
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [applyList, setApplyList] = useState<ApplyInfo[]>([]);

  // 마스터
  const [masters, setMasters] = useState<Masters | null>(null);

  // 정산 / 로그
  const [settlement, setSettlement] = useState<{ rows: SettlementRow[]; total: SettlementTotal } | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // 팀 자리 관리
  const [stations, setStations] = useState<Station[]>([]);
  const [stationForm, setStationForm] = useState({ store_name: '강남점', name: '' });
  const [stationError, setStationError] = useState('');
  const [stationLoading, setStationLoading] = useState(false);

  // 게임 생성 폼
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    store: 'A',
    season: '0',
    gameType: 'A',
    gameName: '대선포커',
    price: 25000,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_STORAGE_KEY) === '1') {
      setIsAuthenticated(true);
    }
  }, []);

  const loadSessions = useCallback(async (page: number) => {
    const res = await adminFetch(`/api/admin/sessions?page=${page}`);
    const data = await res.json();
    if (data && Array.isArray(data.sessions)) {
      setSessions(data.sessions);
      setSessionTotal(data.total ?? 0);
      setSessionPage(data.page ?? page);
    }
  }, []);

  const loadMasters = useCallback(async () => {
    const res = await adminFetch('/api/admin/masters');
    const data = await res.json();
    if (data && Array.isArray(data.stores)) {
      setMasters(data as Masters);
      // 폼 기본값을 활성 마스터의 첫 항목으로 보정
      setFormData((prev) => {
        const firstActive = (rows: MasterRow[], current: string) => {
          const actives = rows.filter((r) => r.active);
          if (actives.some((r) => r.code === current)) return current;
          return actives[0]?.code ?? current;
        };
        const gameType = firstActive(data.game_types, prev.gameType);
        const gt = (data.game_types as MasterRow[]).find((g) => g.code === gameType);
        return {
          ...prev,
          store: firstActive(data.stores, prev.store),
          season: firstActive(data.seasons, prev.season),
          gameType,
          gameName: gt?.name ?? prev.gameName,
        };
      });
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadSessions(1);
    loadMasters();
  }, [isAuthenticated, loadSessions, loadMasters]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab === 'settlement') loadSettlement();
    if (tab === 'logs') loadLogs();
  }, [tab, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStations = useCallback(async () => {
    const res = await adminFetch('/api/admin/stations');
    const data = await res.json();
    if (Array.isArray(data.stations)) setStations(data.stations);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadStations();
  }, [isAuthenticated, loadStations]);

  async function createStation(e: React.FormEvent) {
    e.preventDefault();
    setStationError('');
    setStationLoading(true);
    try {
      const res = await adminFetch('/api/admin/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: stationForm.store_name.trim(),
          name: stationForm.name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStationError(data.error || '등록에 실패했습니다.');
        return;
      }
      setStationForm((prev) => ({ ...prev, name: '' }));
      await loadStations();
    } catch (err) {
      console.error('팀 자리 등록 오류:', err);
      setStationError('등록 중 오류가 발생했습니다.');
    } finally {
      setStationLoading(false);
    }
  }

  async function deleteStation(station: Station) {
    if (station.active_session_id) return;
    if (!confirm(`"${station.name}" 팀 자리를 삭제하시겠습니까?`)) return;
    try {
      const res = await adminFetch(`/api/admin/stations/${encodeURIComponent(station.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '삭제에 실패했습니다.');
        return;
      }
      await loadStations();
    } catch (err) {
      console.error('팀 자리 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }

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

  async function loadSettlement() {
    const res = await adminFetch('/api/admin/settlement');
    const data = await res.json();
    if (data && Array.isArray(data.rows)) setSettlement(data);
  }

  async function loadLogs() {
    const res = await adminFetch('/api/admin/audit-log');
    const data = await res.json();
    if (Array.isArray(data)) setLogs(data);
  }

  // session_id: YYMMDD + 매장 + 시즌 + 게임타입 + 타임슬롯
  function generateSessionId(date: string, time: string, store: string, season: string, gameType: string): string {
    const dateObj = new Date(date);
    const yy = dateObj.getFullYear().toString().slice(2);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const dd = dateObj.getDate().toString().padStart(2, '0');

    const hour = parseInt(time.split(':')[0]);
    const minute = parseInt(time.split(':')[1]);
    const totalMinutes = hour * 60 + minute;

    let timeSlot = '1';
    if (totalMinutes >= 12 * 60 && totalMinutes < 15 * 60) {
      timeSlot = '1';
    } else if (totalMinutes >= 15 * 60 && totalMinutes < 18 * 60) {
      timeSlot = '2';
    } else if (totalMinutes >= 19 * 60 && totalMinutes < 21 * 60) {
      timeSlot = '3';
    }

    return `${yy}${mm}${dd}${store}${season}${gameType}${timeSlot}`;
  }

  async function createSession() {
    try {
      const sessionId = generateSessionId(
        formData.date,
        formData.time,
        formData.store,
        formData.season,
        formData.gameType
      );
      const gameKind = masters?.game_types.find((g) => g.code === formData.gameType)?.game_kind ?? 'game_0a';

      const res = await adminFetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          game_name: formData.gameName,
          game_kind: gameKind,
          session_date: formData.date,
          session_time: formData.time,
          max_capacity: 12,
          current_capacity: 0,
          base_price: formData.price,
          status: '모집중',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = String(err.error || res.statusText);
        if (msg.includes('duplicate') || msg.includes('sessions_pkey')) {
          alert('이미 동일한 세션 ID가 존재합니다. 시간이나 매장을 변경해주세요.');
        } else {
          alert('게임 생성 실패: ' + msg);
        }
        return;
      }

      alert(`게임 생성 완료!\nSession ID: ${sessionId}`);
      await loadSessions(1);

      setFormData({
        ...formData,
        date: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      console.error('세션 생성 오류:', err);
      alert('게임 생성 중 오류가 발생했습니다.');
    }
  }

  async function viewSessionDetail(session: Session) {
    setSelectedSession(session);
    const res = await adminFetch(`/api/admin/apply?session_id=${encodeURIComponent(session.session_id)}`);
    const data = await res.json();
    if (Array.isArray(data)) setApplyList(data);
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('이 게임을 삭제(숨김)하시겠습니까?\n진행 중인 신청은 자동 취소되고 사용한 크레딧은 환불됩니다.\n정산 이력은 보존됩니다.')) {
      return;
    }
    try {
      const res = await adminFetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert('삭제 실패: ' + (err.error || res.statusText));
        return;
      }
      const result = await res.json();
      alert(`삭제 완료! (자동 취소된 신청 ${result.cancelled_applies ?? 0}건)`);
      await loadSessions(sessionPage);
      setSelectedSession(null);
      setApplyList([]);
    } catch (err) {
      console.error('세션 삭제 오류:', err);
      alert('게임 삭제 중 오류가 발생했습니다.');
    }
  }

  async function toggleDeposit(applyId: string, checked: boolean) {
    try {
      const res = await adminFetch(`/api/admin/apply/${applyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deposit_confirmed: checked,
          status: checked ? '확정' : '신청중',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (selectedSession) await viewSessionDetail(selectedSession);
    } catch (err) {
      console.error('입금 확인 오류:', err);
      alert('입금 확인 처리 중 오류가 발생했습니다.');
    }
  }

  async function updateSessionStatus(sessionId: string, newStatus: string) {
    try {
      const res = await adminFetch(`/api/admin/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert('상태 변경 실패: ' + (err.error || res.statusText));
        return;
      }
      await loadSessions(sessionPage);
      if (selectedSession?.session_id === sessionId) {
        setSelectedSession({ ...selectedSession, status: newStatus });
      }
    } catch (err) {
      console.error('상태 변경 오류:', err);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  }

  // ── 마스터 관리 ──
  async function addMasterRow(table: keyof Masters) {
    const code = prompt('코드 (한 글자, 예: D)')?.trim().toUpperCase();
    if (!code) return;
    const name = prompt('이름')?.trim();
    if (!name) return;
    const body: Record<string, unknown> = { code, name };
    if (table === 'game_types') {
      const kind = prompt('game_kind (예: game_0c)')?.trim();
      if (!kind) return;
      body.game_kind = kind;
    }
    const res = await adminFetch(`/api/admin/masters/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      alert('추가 실패: ' + (err.error || res.statusText));
      return;
    }
    await loadMasters();
  }

  async function renameMasterRow(table: keyof Masters, row: MasterRow) {
    const name = prompt('새 이름', row.name)?.trim();
    if (!name || name === row.name) return;
    const res = await adminFetch(`/api/admin/masters/${table}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: row.code, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert('수정 실패: ' + (err.error || res.statusText));
      return;
    }
    await loadMasters();
  }

  async function toggleMasterActive(table: keyof Masters, row: MasterRow) {
    const res = await adminFetch(`/api/admin/masters/${table}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: row.code, active: !row.active }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert('변경 실패: ' + (err.error || res.statusText));
      return;
    }
    await loadMasters();
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ width: '100%', maxWidth: 320, padding: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 18, marginBottom: 24, textAlign: 'center' }}>DO:LAB ADMIN</h1>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              type="password"
              placeholder="비밀번호"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
              className="form-input"
              style={{ padding: 12, border: '2px solid #ff4f00', background: 'transparent', color: '#fff' }}
            />
            {authError && <p style={{ color: '#ef4444', fontSize: 14 }}>{authError}</p>}
            <button type="submit" className="form-input" style={{ padding: 12, background: '#ff4f00', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(sessionTotal / 20));
  const activeOptions = (rows: MasterRow[] | undefined) => (rows ?? []).filter((r) => r.active);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="logo-area">DO:LAB <span>ADMIN</span></div>
        <div className="user-area">
          <a
            href="/manager"
            style={{ color: '#ff4f00', fontSize: 13, marginRight: 16, textDecoration: 'none' }}
          >
            매니저 화면 열기 →
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/admin/login', { method: 'DELETE', credentials: 'include' });
              sessionStorage.removeItem(ADMIN_STORAGE_KEY);
              window.location.reload();
            }}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 탭 바 */}
      <nav className="admin-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {/* ════ 세션 관리 ════ */}
      {tab === 'sessions' && (
        <div className="admin-container">
          {/* 좌측: 게임 생성 폼 */}
          <div className="admin-left">
            <div className="admin-card">
              <h2 className="card-title">
                <i className="fa-solid fa-plus-circle"></i> 새 게임 세션 생성
              </h2>

              <div className="form-section">
                <label className="form-label">날짜</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="form-section">
                <label className="form-label">시간 (타임슬롯)</label>
                <select
                  className="form-input"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                >
                  <option value="12:00">1타임 - 12:00 ~ 15:00</option>
                  <option value="15:00">2타임 - 15:00 ~ 18:00</option>
                  <option value="19:00">3타임 - 19:00 ~ 21:00</option>
                </select>
              </div>

              <div className="form-section">
                <label className="form-label">매장</label>
                <select
                  className="form-input"
                  value={formData.store}
                  onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                >
                  {activeOptions(masters?.stores).map((s) => (
                    <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-section" style={{ flex: 1 }}>
                  <label className="form-label">시즌</label>
                  <select
                    className="form-input"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                  >
                    {activeOptions(masters?.seasons).map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-section" style={{ flex: 1 }}>
                  <label className="form-label">게임 타입</label>
                  <select
                    className="form-input"
                    value={formData.gameType}
                    onChange={(e) => {
                      const gameType = e.target.value;
                      const gt = masters?.game_types.find((g) => g.code === gameType);
                      setFormData({ ...formData, gameType, gameName: gt?.name ?? formData.gameName });
                    }}
                  >
                    {activeOptions(masters?.game_types).map((g) => (
                      <option key={g.code} value={g.code}>{g.code} · {g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-section">
                <label className="form-label">게임명</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.gameName}
                  onChange={(e) => setFormData({ ...formData, gameName: e.target.value })}
                />
              </div>

              <div className="form-section">
                <label className="form-label">참가비 (원)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                />
              </div>

              <div className="session-id-preview">
                <strong>생성될 Session ID:</strong>
                <div className="session-id-value">
                  {generateSessionId(formData.date, formData.time, formData.store, formData.season, formData.gameType)}
                </div>
              </div>

              <button className="btn-create" onClick={createSession}>
                <i className="fa-solid fa-check"></i> 게임 생성
              </button>
            </div>
          </div>

          {/* 우측: 게임 목록 & 상세 */}
          <div className="admin-right">
            <div className="admin-card">
              <h2 className="card-title">
                <i className="fa-solid fa-list"></i> 생성된 게임 세션 ({sessionTotal})
              </h2>

              <div className="session-list">
                {sessions.length === 0 ? (
                  <div className="empty-state">생성된 게임이 없습니다</div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.session_id}
                      className={`session-card ${selectedSession?.session_id === session.session_id ? 'active' : ''}`}
                      onClick={() => viewSessionDetail(session)}
                    >
                      <div className="session-card-header">
                        <div className="session-id">{session.session_id}</div>
                        <div className={`status-badge ${session.status === '모집중' ? 'open' : 'closed'}`}>
                          {session.status}
                        </div>
                      </div>
                      <div className="session-card-body">
                        <div className="session-info-row">
                          <i className="fa-solid fa-gamepad"></i>
                          <span>{session.game_name}</span>
                        </div>
                        <div className="session-info-row">
                          <i className="fa-solid fa-calendar"></i>
                          <span>{session.session_date} {session.session_time}</span>
                        </div>
                        <div className="session-info-row">
                          <i className="fa-solid fa-users"></i>
                          <span>{session.current_capacity} / {session.max_capacity}명</span>
                        </div>
                        <div className="session-info-row">
                          <i className="fa-solid fa-won-sign"></i>
                          <span>{(session.base_price || 0).toLocaleString()}원</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="admin-pagination">
                  <button
                    type="button"
                    disabled={sessionPage <= 1}
                    onClick={() => loadSessions(sessionPage - 1)}
                  >
                    이전
                  </button>
                  <span>{sessionPage} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={sessionPage >= totalPages}
                    onClick={() => loadSessions(sessionPage + 1)}
                  >
                    다음
                  </button>
                </div>
              )}
            </div>

            {/* 상세 정보 */}
            {selectedSession && (
              <div className="admin-card">
                <h2 className="card-title">
                  <i className="fa-solid fa-info-circle"></i> 세션 상세 정보
                </h2>

                <div className="detail-section">
                  <h3>기본 정보</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Session ID:</span>
                      <span className="detail-value">{selectedSession.session_id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">게임명:</span>
                      <span className="detail-value">{selectedSession.game_name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">날짜:</span>
                      <span className="detail-value">{selectedSession.session_date}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">시간:</span>
                      <span className="detail-value">{selectedSession.session_time}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">현재 인원:</span>
                      <span className="detail-value">{selectedSession.current_capacity} / {selectedSession.max_capacity}명</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">참가비:</span>
                      <span className="detail-value">{(selectedSession.base_price || 0).toLocaleString()}원</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>신청자 목록 ({applyList.length}명)</h3>
                  {applyList.length === 0 ? (
                    <div className="empty-state">신청자가 없습니다</div>
                  ) : (
                    <table className="apply-table">
                      <thead>
                        <tr>
                          <th>이름</th>
                          <th>전화번호</th>
                          <th>크레딧 사용</th>
                          <th>최종 금액</th>
                          <th>상태</th>
                          <th>입금</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applyList.map((apply) => (
                          <tr key={apply.id}>
                            <td>{apply.user_name}</td>
                            <td>{apply.phone}</td>
                            <td>{(apply.used_credits || 0).toLocaleString()}원</td>
                            <td>{(apply.final_price || 0).toLocaleString()}원</td>
                            <td>
                              <span className={`apply-status ${apply.status}`}>
                                {apply.status}
                              </span>
                            </td>
                            <td>
                              {apply.status === '신청중' || apply.status === '확정' ? (
                                <input
                                  type="checkbox"
                                  checked={apply.deposit_confirmed}
                                  onChange={(e) => toggleDeposit(apply.id, e.target.checked)}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="detail-actions">
                  <button
                    className="btn-action btn-primary"
                    onClick={() => updateSessionStatus(selectedSession.session_id, selectedSession.status === '모집중' ? '마감' : '모집중')}
                  >
                    {selectedSession.status === '모집중' ? '모집 마감' : '모집 재개'}
                  </button>
                  <button
                    className="btn-action btn-danger"
                    onClick={() => deleteSession(selectedSession.session_id)}
                  >
                    게임 삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ 정산 ════ */}
      {tab === 'settlement' && (
        <div className="admin-single-container">
          <div className="admin-card">
            <h2 className="card-title">
              <i className="fa-solid fa-coins"></i> 세션별 정산
            </h2>
            {!settlement ? (
              <div className="empty-state">불러오는 중...</div>
            ) : settlement.rows.length === 0 ? (
              <div className="empty-state">세션이 없습니다</div>
            ) : (
              <table className="apply-table">
                <thead>
                  <tr>
                    <th>세션</th>
                    <th>게임</th>
                    <th>일시</th>
                    <th>신청</th>
                    <th>입금확정</th>
                    <th>매출</th>
                    <th>크레딧 사용</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.rows.map((r) => (
                    <tr key={r.session_id} style={r.deleted ? { opacity: 0.5 } : undefined}>
                      <td>
                        {r.session_id}
                        {r.deleted && <span style={{ marginLeft: 6, fontSize: 11, color: '#ff4444' }}>(삭제됨)</span>}
                      </td>
                      <td>{r.game_name}</td>
                      <td>{r.session_date} {r.session_time?.slice(0, 5)}</td>
                      <td>{r.apply_count}명</td>
                      <td>{r.confirmed_count}명</td>
                      <td>{r.revenue.toLocaleString()}원</td>
                      <td>{r.credits_used.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: '#fff5f0' }}>
                    <td colSpan={3}>합계</td>
                    <td>{settlement.total.apply_count}명</td>
                    <td>{settlement.total.confirmed_count}명</td>
                    <td>{settlement.total.revenue.toLocaleString()}원</td>
                    <td>{settlement.total.credits_used.toLocaleString()}원</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════ 마스터 관리 ════ */}
      {tab === 'masters' && (
        <div className="admin-single-container">
          {([
            ['stores', '매장'],
            ['seasons', '시즌'],
            ['game_types', '게임 타입'],
          ] as [keyof Masters, string][]).map(([table, label]) => (
            <div key={table} className="admin-card">
              <h2 className="card-title">
                <i className="fa-solid fa-table-list"></i> {label}
                <button
                  type="button"
                  className="btn-action btn-primary"
                  style={{ marginLeft: 'auto', flex: 'none', padding: '8px 16px', fontSize: 13 }}
                  onClick={() => addMasterRow(table)}
                >
                  + 추가
                </button>
              </h2>
              <table className="apply-table">
                <thead>
                  <tr>
                    <th>코드</th>
                    <th>이름</th>
                    {table === 'game_types' && <th>game_kind</th>}
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {(masters?.[table] ?? []).map((row) => (
                    <tr key={row.code} style={!row.active ? { opacity: 0.45 } : undefined}>
                      <td style={{ fontWeight: 800 }}>{row.code}</td>
                      <td>{row.name}</td>
                      {table === 'game_types' && <td>{row.game_kind}</td>}
                      <td>{row.active ? '활성' : '비활성'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-action"
                            style={{ flex: 'none', padding: '6px 12px', fontSize: 12, background: '#eee' }}
                            onClick={() => renameMasterRow(table, row)}
                          >
                            이름 변경
                          </button>
                          <button
                            type="button"
                            className={`btn-action ${row.active ? 'btn-danger' : 'btn-primary'}`}
                            style={{ flex: 'none', padding: '6px 12px', fontSize: 12 }}
                            onClick={() => toggleMasterActive(table, row)}
                          >
                            {row.active ? '비활성화' : '활성화'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ════ 활동 로그 ════ */}
      {tab === 'logs' && (
        <div className="admin-single-container">
          <div className="admin-card">
            <h2 className="card-title">
              <i className="fa-solid fa-clock-rotate-left"></i> 활동 로그 (최근 100건)
            </h2>
            {logs.length === 0 ? (
              <div className="empty-state">기록이 없습니다</div>
            ) : (
              <table className="apply-table">
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>액션</th>
                    <th>대상</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ fontWeight: 700 }}>{log.action}</td>
                      <td>{log.target_type}{log.target_id ? ` · ${log.target_id}` : ''}</td>
                      <td style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
                        {log.detail ? JSON.stringify(log.detail) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════ 팀 자리 관리 ════ */}
      <div className="admin-single-container" style={{ marginTop: 32 }}>
        <div className="admin-card">
          <h2 className="card-title">
            <i className="fa-solid fa-chair"></i> 팀 자리 관리
          </h2>

          <form onSubmit={createStation} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
            <div className="form-section" style={{ flex: '1 1 160px', marginBottom: 0 }}>
              <label className="form-label">매장</label>
              <input
                type="text"
                className="form-input"
                value={stationForm.store_name}
                onChange={(e) => setStationForm({ ...stationForm, store_name: e.target.value })}
              />
            </div>
            <div className="form-section" style={{ flex: '1 1 160px', marginBottom: 0 }}>
              <label className="form-label">팀 이름</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 블랙팀"
                value={stationForm.name}
                onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="btn-action btn-primary"
              style={{ flex: 'none', padding: '12px 20px' }}
              disabled={stationLoading || !stationForm.name.trim()}
            >
              {stationLoading ? '등록 중...' : '등록'}
            </button>
          </form>

          {stationError && (
            <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 16 }}>{stationError}</p>
          )}

          {stations.length === 0 ? (
            <div className="empty-state">등록된 팀 자리가 없습니다</div>
          ) : (
            <table className="apply-table">
              <thead>
                <tr>
                  <th>매장</th>
                  <th>팀 이름</th>
                  <th>현재 세션</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((station) => {
                  const inProgress = station.active_session_id != null && station.active_session_id.trim() !== '';
                  return (
                    <tr key={station.id}>
                      <td>{station.store_name}</td>
                      <td style={{ fontWeight: 700 }}>{station.name}</td>
                      <td>{inProgress ? station.active_session_id : '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-action btn-danger"
                          style={{ flex: 'none', padding: '6px 12px', fontSize: 12 }}
                          disabled={inProgress}
                          title={inProgress ? '게임 종료 후 삭제 가능' : undefined}
                          onClick={() => deleteStation(station)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
