'use client';

import { useState, useEffect } from 'react';
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
  session_date: string;
  session_time: string;
  max_capacity: number;
  current_capacity: number;
  base_price: number;  // price -> base_price로 변경
  status: string;
  created_at: string;
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

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [applyList, setApplyList] = useState<ApplyInfo[]>([]);
  
  // 게임 생성 폼
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '12:00',  // 기본값을 첫 번째 타임슬롯으로
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

  // session_id 자동 생성 함수
  // 형식: YYMMDD + 매장 + 시즌 + 게임타입 + 타임슬롯
  // 예: 260225A0A1 = 2026년 2월 25일, A매장, 0시즌, A게임, 1타임
  function generateSessionId(date: string, time: string, store: string, season: string, gameType: string): string {
    // 날짜: YYMMDD
    const dateObj = new Date(date);
    const yy = dateObj.getFullYear().toString().slice(2); // 26
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0'); // 02
    const dd = dateObj.getDate().toString().padStart(2, '0'); // 25
    
    // 타임슬롯: 시간대별 구분
    const hour = parseInt(time.split(':')[0]);
    const minute = parseInt(time.split(':')[1]);
    const totalMinutes = hour * 60 + minute;
    
    let timeSlot = '1'; // 기본값
    
    if (totalMinutes >= 12 * 60 && totalMinutes < 15 * 60) {
      timeSlot = '1';      // 1타임: 12:00 ~ 14:59
    } else if (totalMinutes >= 15 * 60 && totalMinutes < 18 * 60) {
      timeSlot = '2';      // 2타임: 15:00 ~ 17:59
    } else if (totalMinutes >= 19 * 60 && totalMinutes < 21 * 60) {
      timeSlot = '3';      // 3타임: 19:00 ~ 20:59
    }
    
    // 최종 형식: YYMMDD + 매장 + 시즌 + 게임타입 + 타임슬롯
    // 예: 260225A0A1
    //     260225 (2026년 2월 25일)
    //     A (A매장)
    //     0 (시즌 0)
    //     A (A게임 = 대선포커)
    //     1 (1타임 = 12:00~15:00)
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

      const sessionsRes = await adminFetch('/api/admin/sessions');
      const sessionsData = await sessionsRes.json();
      const existing = Array.isArray(sessionsData) && sessionsData.some((s: Session) => s.session_id === sessionId);

      if (existing) {
        alert('이미 동일한 세션 ID가 존재합니다. 시간이나 매장을 변경해주세요.');
        return;
      }

      const res = await adminFetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          game_name: formData.gameName,
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
        alert('게임 생성 실패: ' + (err.error || res.statusText));
        return;
      }

      alert(`게임 생성 완료!\nSession ID: ${sessionId}`);
      await loadSessions();
      
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
    if (!confirm('정말 이 게임을 삭제하시겠습니까?\n관련된 신청 내역도 모두 삭제됩니다.')) {
      return;
    }
    try {
      const res = await adminFetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert('삭제 실패: ' + (err.error || res.statusText));
        return;
      }
      alert('삭제 완료!');
      await loadSessions();
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
      await loadSessions();
      if (selectedSession?.session_id === sessionId) {
        setSelectedSession({ ...selectedSession, status: newStatus });
      }
    } catch (err) {
      console.error('상태 변경 오류:', err);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
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

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="logo-area">DO:LAB <span>ADMIN</span></div>
        <div className="user-area">
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
                <option value="A">A 매장</option>
                <option value="B">B 매장</option>
                <option value="C">C 매장</option>
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
                  <option value="0">시즌 0</option>
                  <option value="1">시즌 1</option>
                  <option value="2">시즌 2</option>
                </select>
              </div>

              <div className="form-section" style={{ flex: 1 }}>
                <label className="form-label">게임 타입</label>
                <select
                  className="form-input"
                  value={formData.gameType}
                  onChange={(e) => setFormData({ ...formData, gameType: e.target.value })}
                >
                  <option value="A">A (대선포커)</option>
                  <option value="B">B (게임2)</option>
                  <option value="C">C (게임3)</option>
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
          
          {/* 게임 목록 */}
          <div className="admin-card">
            <h2 className="card-title">
              <i className="fa-solid fa-list"></i> 생성된 게임 세션 ({sessions.length})
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
                      {applyList.map((apply, idx) => (
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
    </div>
  );
}
