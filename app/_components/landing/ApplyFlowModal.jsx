'use client';

/* eslint-disable react/no-unescaped-entities, @next/next/no-img-element */

import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { PRIVACY_TERMS, MARKETING_TERMS, REFUND_TERMS } from '@/lib/landing/apply-terms';
import { formatSessionTimeRange } from '@/lib/landing/format-session';

const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_nVsZX';

export function ApplyFlowModal({ flow }) {
  const {
    FLOW_STEPS,
    flowOpen,
    stepIdx,
    sessions,
    allSessions,
    loadingSessions,
    sessionLoadError,
    name,
    setName,
    phone,
    setPhone,
    nickname,
    setNickname,
    password,
    setPassword,
    privacyConsent,
    setPrivacyConsent,
    marketingConsent,
    setMarketingConsent,
    referrer,
    setReferrer,
    isExistingUser,
    userCredits,
    selectedSession,
    setSelectedSession,
    creditUsed,
    setCreditUsed,
    refundConsent,
    setRefundConsent,
    loading,
    error,
    termsModal,
    setTermsModal,
    showAvailability,
    setShowAvailability,
    showSignupConfirm,
    setShowSignupConfirm,
    showEventModal,
    setShowEventModal,
    selectedSessionData,
    creditNum,
    finalFee,
    canNext,
    normalizePhone,
    closeFlow,
    handleStep1Continue,
    handleStep2Continue,
    handleSignupConfirm,
    handleApplyComplete,
    handleCheckCredits,
    handleFlowBack,
    openAvailability,
    setStepIdx,
  } = flow;

  if (!flowOpen) return null;

  const primaryAction = () => {
    if (stepIdx === 0) setStepIdx(1);
    else if (stepIdx === 1) handleStep1Continue();
    else if (stepIdx === 2) handleStep2Continue();
    else if (stepIdx === 3) handleApplyComplete();
  };

  const primaryLabel =
    stepIdx === 0
      ? '시작하기'
      : stepIdx === 1
        ? loading
          ? '확인 중…'
          : '다음'
        : stepIdx === 2
          ? loading
            ? isExistingUser
              ? '로그인 중…'
              : '확인 중…'
            : isExistingUser
              ? '로그인'
              : '가입 및 신청하기'
          : stepIdx === 3
            ? loading
              ? '신청 중…'
              : '신청 완료'
            : '';

  return (
    <>
      <div className="flow" onClick={closeFlow}>
        <div className="flow-panel" onClick={(e) => e.stopPropagation()}>
          <div className="flow-bar">
            <span className="flow-title"><span className="sq" />피험자 등록</span>
            <span className="flow-num mono">{String(stepIdx + 1).padStart(2, '0')} / 05</span>
          </div>
          <div className="flow-steps">
            {FLOW_STEPS.map((l, i) => (
              <span key={l} className={`flow-step ${i < stepIdx ? 'done' : ''} ${i === stepIdx ? 'now' : ''}`}>
                {String(i + 1).padStart(2, '0')} {l}
              </span>
            ))}
          </div>

          <div className="flow-body">
            {/* 0 — 시작 (허브) */}
            {stepIdx === 0 && (
              <>
                <p className="flow-hub-lead">
                  신인류 프로젝트, <b>DO:NEON PROJECT</b>에 참가하세요.
                  <br />
                  신뢰와 배신의 오프라인 소셜전략게임 — 당신의 두뇌, ON.
                </p>
                <div className="flow-price">
                  <span className="price-old mono">35,000</span>
                  <span className="price-now mono">25,000원</span>
                  <span className="price-tag">28% 할인</span>
                </div>
                <p className="hint">시즌 0 · 수송선게임 등 · 룰 브리핑 포함 약 150분</p>
                <button type="button" className="btn btn-line btn-block flow-hub-btn" onClick={openAvailability}>
                  실시간 예약 확인
                </button>
              </>
            )}

            {/* 1 — 정보 (성명·전화) */}
            {stepIdx === 1 && (
              <>
                <div className="field">
                  <label className="label" htmlFor="apply-name">성명</label>
                  <input id="apply-name" className="input" placeholder="김네온" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="apply-phone">전화번호</label>
                  <input
                    id="apply-phone"
                    className="input mono"
                    placeholder="01012345678"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <div className="hint">입금 계좌와 참가 안내를 문자로 보냅니다.</div>
                </div>
              </>
            )}

            {/* 2 — 인증 (가입/로그인) */}
            {stepIdx === 2 && (
              <>
                {isExistingUser && (
                  <div className="field">
                    <span className="label">닉네임</span>
                    <div className="input readonly">{nickname}</div>
                  </div>
                )}
                {!isExistingUser && (
                  <div className="field">
                    <label className="label" htmlFor="apply-nick">닉네임</label>
                    <input id="apply-nick" className="input" placeholder="(한글 2-6자)" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="apply-pw">패스워드 (숫자 4자리)</label>
                  <input
                    id="apply-pw"
                    className="input mono"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </div>
                {!isExistingUser && (
                  <>
                    <div className={`check ${privacyConsent ? 'on' : ''}`} role="checkbox" aria-checked={privacyConsent} tabIndex={0} onClick={() => setPrivacyConsent(!privacyConsent)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPrivacyConsent(!privacyConsent); } }}>
                      <span className="check-box">{privacyConsent && <Check size={15} strokeWidth={3.5} />}</span>
                      <span className="check-label">개인정보 수집 및 이용 동의 (필수)</span>
                      <button type="button" className="terms-link" onClick={(e) => { e.stopPropagation(); setTermsModal('privacy'); }}>약관</button>
                    </div>
                    <div className={`check ${marketingConsent ? 'on' : ''}`} role="checkbox" aria-checked={marketingConsent} tabIndex={0} onClick={() => setMarketingConsent(!marketingConsent)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMarketingConsent(!marketingConsent); } }}>
                      <span className="check-box">{marketingConsent && <Check size={15} strokeWidth={3.5} />}</span>
                      <span className="check-label">마케팅 정보 수신 동의 (선택)</span>
                      <button type="button" className="terms-link" onClick={(e) => { e.stopPropagation(); setTermsModal('marketing'); }}>약관</button>
                      <button type="button" className="terms-link event" onClick={(e) => { e.stopPropagation(); setShowEventModal('newuser'); }}>EVENT</button>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="apply-ref">
                        추천인 (선택)
                        <button type="button" className="terms-link event inline" onClick={() => setShowEventModal('referrer')}>EVENT</button>
                      </label>
                      <input id="apply-ref" className="input mono" placeholder="01012345678" inputMode="numeric" value={referrer} onChange={(e) => setReferrer(e.target.value.replace(/[^0-9]/g, ''))} />
                    </div>
                  </>
                )}
              </>
            )}

            {/* 3 — 결제 (일정·크레딧·환불) */}
            {stepIdx === 3 && (
              <>
                <div className="field">
                  <label className="label" htmlFor="apply-session">참가 세션</label>
                  {loadingSessions ? (
                    <p className="hint">세션 불러오는 중…</p>
                  ) : (
                    <select id="apply-session" className="select" value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
                      <option value="">세션을 선택해 주세요</option>
                      {sessions.map((s) => (
                        <option key={s.session_id} value={s.session_id}>
                          {s.game_name} | {s.session_date} {formatSessionTimeRange(s.session_time)} | 잔여 {s.available_slots}석
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {selectedSessionData && (
                  <div className="mini">
                    <div>
                      <b>{selectedSessionData.game_name}</b>
                      <div><span className="mono">{selectedSessionData.session_date} · {formatSessionTimeRange(selectedSessionData.session_time)}</span></div>
                    </div>
                    <b className="mono">{selectedSessionData.base_price.toLocaleString()}원</b>
                  </div>
                )}
                <div className="field">
                  <label className="label" htmlFor="apply-credit">크레딧 사용</label>
                  <div className="inline">
                    <input id="apply-credit" className="input mono" placeholder="0" inputMode="numeric" style={{ maxWidth: 150 }} value={creditUsed} onChange={(e) => setCreditUsed(e.target.value.replace(/[^0-9]/g, ''))} />
                    <button type="button" className="btn btn-line" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }} onClick={() => setCreditUsed(String(Math.min(userCredits, selectedSessionData?.base_price ?? 0)))}>전액 사용</button>
                    <button type="button" className="btn btn-line" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }} onClick={handleCheckCredits} disabled={loading}>잔여 확인</button>
                  </div>
                  <div className="hint">보유 크레딧: <b className="mono">{userCredits.toLocaleString()}</b> (1,000원 단위)</div>
                </div>
                {selectedSessionData && (
                  <div className="field">
                    <span className="label">최종 참가비</span>
                    <div className="price-line">
                      {creditNum > 0 && <span className="price-old mono">{selectedSessionData.base_price.toLocaleString()}</span>}
                      <span className="price-now mono">{finalFee?.toLocaleString()}원</span>
                      {creditNum > 0 && <span className="price-tag">-{creditNum.toLocaleString()}</span>}
                    </div>
                  </div>
                )}
                <div className={`check ${refundConsent ? 'on' : ''}`} role="checkbox" aria-checked={refundConsent} tabIndex={0} onClick={() => setRefundConsent(!refundConsent)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRefundConsent(!refundConsent); } }}>
                  <span className="check-box">{refundConsent && <Check size={15} strokeWidth={3.5} />}</span>
                  <span className="check-label">환불 규정에 동의합니다 (필수)</span>
                  <button type="button" className="terms-link" onClick={(e) => { e.stopPropagation(); setTermsModal('refund'); }}>약관</button>
                </div>
                <div className="notice-box">
                  <p>신청 후 입금 계좌를 문자로 보냅니다. 12시간 내 미입금 시 자동 취소됩니다.</p>
                  <div className="acct">카카오뱅크 3333-16-760925 · 김석원</div>
                </div>
              </>
            )}

            {/* 4 — 완료 */}
            {stepIdx === 4 && (
              <div className="done">
                <h2>신청 <em>완료</em></h2>
                <div className="done-id">
                  <small>SUBJECT</small>
                  <b>{nickname || name || '테스터'}</b>
                </div>
                <p>
                  {name || '테스터'}님, 등록 완료.
                  {selectedSessionData && (
                    <> {selectedSessionData.game_name} ({selectedSessionData.session_date})</>
                  )}
                  <br />
                  입금 계좌를 문자로 보냈습니다 — 12시간 내 입금 시 확정.
                </p>
                <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="hint flow-kakao">카카오톡 채널 문의</a>
              </div>
            )}

            {error && <p className="flow-error">{error}</p>}
          </div>

          {stepIdx < 4 && (
            <div className="flow-nav">
              {stepIdx > 0 ? (
                <button type="button" className="back-link" onClick={handleFlowBack}><ArrowLeft size={15} /> 이전</button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="btn btn-fill"
                disabled={loading || (stepIdx === 1 ? !canNext : stepIdx === 3 ? !canNext : false)}
                onClick={primaryAction}
              >
                {primaryLabel} {stepIdx < 3 && <ArrowRight size={16} />}
              </button>
            </div>
          )}

          {stepIdx === 4 && (
            <div className="flow-nav">
              <span />
              <button type="button" className="btn btn-fill" onClick={closeFlow}>확인</button>
            </div>
          )}
        </div>
      </div>

      {/* 약관 */}
      {termsModal && (
        <div className="sub-overlay" onClick={() => setTermsModal(null)}>
          <div className="sub-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sub-head">
              <b>{termsModal === 'privacy' ? '개인정보 수집 및 이용' : termsModal === 'marketing' ? '마케팅 정보 수신' : '환불 규정'}</b>
            </div>
            <div className="sub-body">
              {termsModal === 'privacy' ? PRIVACY_TERMS : termsModal === 'marketing' ? MARKETING_TERMS : REFUND_TERMS}
            </div>
            <div className="sub-foot">
              <button type="button" className="btn btn-fill btn-block" onClick={() => setTermsModal(null)}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 예약 */}
      {showAvailability && (
        <div className="sub-overlay" onClick={() => setShowAvailability(false)}>
          <div className="sub-panel wide" onClick={(e) => e.stopPropagation()}>
            <div className="sub-head"><b>실시간 예약 현황</b></div>
            <div className="sub-body scroll">
              {loadingSessions ? (
                <p className="hint">로딩 중…</p>
              ) : allSessions.length === 0 ? (
                <p className="hint">예약 가능한 세션이 없습니다.</p>
              ) : (
                allSessions.map((session) => {
                  const closed = session.status === '마감' || session.available_slots <= 0;
                  const status = closed ? 'closed' : session.current_capacity >= 8 ? 'confirm' : 'ok';
                  const statusLabel = closed ? '마감' : session.current_capacity >= 8 ? '진행확정' : '모집중';
                  return (
                    <div key={session.session_id} className={`avail-row ${closed ? 'closed' : ''}`}>
                      <div className="avail-top">
                        <b>{session.game_name}</b>
                        <span className={`avail-badge ${status}`}>{statusLabel}</span>
                      </div>
                      <p className="mono hint">{session.session_date} {formatSessionTimeRange(session.session_time)} · {session.base_price.toLocaleString()}원</p>
                      <p className="hint">{session.current_capacity}/{session.max_capacity}명 · 잔여 {session.available_slots}석</p>
                    </div>
                  );
                })
              )}
            </div>
            <div className="sub-foot">
              <button type="button" className="btn btn-fill btn-block" onClick={() => setShowAvailability(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT */}
      {showEventModal && (
        <div className="sub-overlay" onClick={() => setShowEventModal(null)}>
          <div className="sub-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sub-head"><b>EVENT!</b></div>
            <div className="sub-body">
              {showEventModal === 'newuser' ? (
                <p>신규 테스터 등록 시 마케팅 정보 동의할 경우, 3,000 크레딧을 적립해드립니다! 적립된 크레딧은 즉시 사용 가능합니다.</p>
              ) : (
                <p>신규 테스터 등록 시 추천인을 입력할 경우, 추천인과 신규 테스터 모두 2,000 크레딧을 적립해드립니다! (추천인 코드는 기존 테스터의 전화번호입니다.)</p>
              )}
            </div>
            <div className="sub-foot">
              <button type="button" className="btn btn-fill btn-block" onClick={() => setShowEventModal(null)}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 가입 확인 */}
      {showSignupConfirm && (
        <div className="sub-overlay" onClick={() => setShowSignupConfirm(false)}>
          <div className="sub-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sub-head"><b>가입 확인</b></div>
            <div className="sub-body">
              <p><b>{nickname}#{normalizePhone(phone).slice(-4) || '****'}</b> 으로 등록하시겠습니까?</p>
              <p className="hint">(#은 PIN 번호이며, 전화번호 뒷자리로 자동 설정됩니다.)</p>
            </div>
            <div className="sub-foot split">
              <button type="button" className="btn btn-line" onClick={() => setShowSignupConfirm(false)}>아니오</button>
              <button type="button" className="btn btn-fill" onClick={handleSignupConfirm} disabled={loading}>예</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
