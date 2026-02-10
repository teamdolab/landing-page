'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power } from 'lucide-react';
import { 
  supabase, 
  checkUserExists, 
  getSessionAvailability, 
  getUserCredits,
  type UserInfo,
  type SessionAvailability 
} from '@/lib/supabase';

const PRIVACY_TERMS = `개인정보 수집 및 이용 동의 (필수)

제1조 (수집 및 이용 목적)
DO:LAB(이하 '회사')은 멤버십 가입 및 행사 진행을 위해 아래와 같이 개인정보를 수집·이용합니다.

• 멤버십 관리: 본인 확인, 멤버십 서비스(크레딧 등) 제공, 불량 회원의 부정이용 방지
• 행사 운영: 참가 신청 접수, 예약 확정 및 취소 안내, 입장 확인
• 고객 지원: 문의 사항 처리 및 공지사항 전달

제2조 (수집하는 항목)
필수항목: 성명, 휴대전화번호, (입금 확인 시) 은행명/입금자명

제3조 (보유 및 이용 기간)
회원 탈퇴 시까지 (단, 관계 법령에 의하여 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.)
• 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)
• 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)

제4조 (동의 거부 권리 및 불이익)
귀하는 개인정보 수집 및 이용에 거부할 권리가 있습니다. 단, 동의를 거부할 경우 멤버십 가입 및 행사 참가 신청이 불가능합니다.

[유의사항 : 크레딧 및 환불 정책]
• 크레딧 성격: 적립된 '크레딧'은 DO:LAB 서비스 내에서만 사용 가능한 비현금성 포인트이며, 현금으로 환급되지 않습니다.
• 소멸: 회원 탈퇴 시 보유 크레딧은 즉시 소멸되며 복구되지 않습니다.
• 회수: 부정한 방법(중복 가입, 허위 추천 등)으로 획득한 크레딧은 사전 통보 없이 회수될 수 있습니다.

회원 탈퇴 및 마케팅 동의 거부는 두랩 카카오톡 플러스 친구를 통해 하실 수 있습니다.`;

const MARKETING_TERMS = `마케팅 정보 수신 및 혜택 알림 동의 (선택)

제1조 (수집 및 이용 목적)
• DO:LAB의 신규 이벤트, 파티, 프로모션 안내 (SMS/알림톡)
• 멤버십 혜택(크레딧, 쿠폰) 지급 및 관리
• 맞춤형 광고 전송 및 이벤트 참여 기회 제공

제2조 (수집 항목)
성명, 휴대전화번호, 마케팅 수신 동의 여부

제3조 (보유 및 이용 기간)
회원 탈퇴 또는 마케팅 동의 철회 시까지

제4조 (동의 거부 권리 및 불이익)
귀하는 마케팅 정보 수신에 대한 동의를 거부할 수 있습니다. 동의하지 않더라도 기본 서비스(행사 예약) 이용에는 제한이 없으나, 마케팅 수신 동의자에게 제공되는 혜택(크레딧 적립, 할인 쿠폰 등)은 제공되지 않습니다.

회원 탈퇴 및 마케팅 동의 거부는 두랩 카카오톡 플러스 친구를 통해 하실 수 있습니다.`;

export default function Home() {
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [sweepDone, setSweepDone] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFormStep2, setShowFormStep2] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  
  // 실시간 예약 현황 모달
  const [showAvailability, setShowAvailability] = useState(false);
  const [sessions, setSessions] = useState<SessionAvailability[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // 폼 데이터
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [referrer, setReferrer] = useState('');
  
  // 유저 정보
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  
  // 참가 신청
  const [selectedSession, setSelectedSession] = useState('');
  const [creditUsed, setCreditUsed] = useState('');
  const [refundConsent, setRefundConsent] = useState(false);
  
  // 약관 모달
  const [termsModal, setTermsModal] = useState<'privacy' | 'marketing' | null>(null);
  
  // 로딩 및 에러
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePowerClick = () => {
    if (isPowerOn) return;
    setIsPowerOn(true);
    setTimeout(() => setSweepDone(true), 1200);
    // 텍스트 전류 효과 끝난 뒤 2초 후 신청 페이지로 전환
    setTimeout(() => setShowSignUp(true), 3200);
  };

  // 실시간 예약 현황 로드
  const loadAvailability = async () => {
    setLoadingSessions(true);
    try {
      const data = await getSessionAvailability();
      setSessions(data);
    } catch (err) {
      console.error('세션 조회 실패:', err);
      setError('세션 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoadingSessions(false);
    }
  };

  // Step 1: 성명 + 전화번호로 유저 확인
  const handleStep1Continue = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('성명과 전화번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await checkUserExists(name, phone);
      
      if (result.user_exists) {
        // 기존 유저
        setIsExistingUser(true);
        setUserId(result.user_id);
        setNickname(result.nickname || '');
        setUserCredits(result.credits);
        // 바로 참가 신청 페이지로
        await loadSessionsForSchedule();
        setShowSchedule(true);
      } else {
        // 신규 유저 - Step 2로 이동
        setIsExistingUser(false);
        setShowFormStep2(true);
      }
    } catch (err) {
      console.error('유저 확인 실패:', err);
      setError('유저 정보를 확인하는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: 신규 유저 가입
  const handleStep2Continue = async () => {
    if (!nickname.trim() || !password || password.length !== 4) {
      setError('닉네임과 4자리 패스워드를 입력해주세요.');
      return;
    }

    if (!privacyConsent) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 신규 유저 등록
      const { data, error: insertError } = await supabase
        .from('user_info')
        .insert({
          name,
          phone,
          nickname,
          password, // TODO: 실제 배포 시 해시 처리
          privacy_consent: privacyConsent,
          privacy_consent_at: new Date().toISOString(),
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? new Date().toISOString() : null,
          referrer_phone: referrer || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('가입 실패:', insertError);
        setError('가입에 실패했습니다: ' + insertError.message);
        return;
      }

      if (data) {
        setUserId(data.id);
        // 크레딧은 DB 트리거에서 자동 충전됨
        // 다시 조회해서 크레딧 확인
        const { data: userData } = await supabase
          .from('user_info')
          .select('credits')
          .eq('id', data.id)
          .single();
        
        if (userData) {
          setUserCredits(userData.credits);
        }
      }

      // 참가 신청 페이지로 이동
      await loadSessionsForSchedule();
      setShowSchedule(true);
    } catch (err) {
      console.error('가입 중 에러:', err);
      setError('가입 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 참가 신청용 세션 로드
  const loadSessionsForSchedule = async () => {
    setLoadingSessions(true);
    try {
      const data = await getSessionAvailability();
      setSessions(data.filter(s => s.status === '모집중')); // 모집 중인 세션만
    } catch (err) {
      console.error('세션 조회 실패:', err);
      setError('세션 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoadingSessions(false);
    }
  };

  // 참가 신청 완료
  const handleApplyComplete = async () => {
    if (!selectedSession) {
      setError('참가 일정을 선택해주세요.');
      return;
    }

    if (!refundConsent) {
      setError('환불 규정에 동의해주세요.');
      return;
    }

    if (!userId) {
      setError('유저 정보가 없습니다.');
      return;
    }

    const usedCreditsNum = Number(creditUsed) || 0;
    if (usedCreditsNum > userCredits) {
      setError('사용 가능한 크레딧을 초과했습니다.');
      return;
    }

    const selectedSessionData = sessions.find(s => s.session_id === selectedSession);
    if (!selectedSessionData) {
      setError('선택한 세션 정보를 찾을 수 없습니다.');
      return;
    }

    const finalPrice = Math.max(0, selectedSessionData.base_price - usedCreditsNum);

    setLoading(true);
    setError('');

    try {
      const { error: applyError } = await supabase
        .from('apply')
        .insert({
          user_id: userId,
          session_id: selectedSession,
          used_credits: usedCreditsNum,
          final_price: finalPrice,
          refund_policy_consent: refundConsent,
          refund_policy_consent_at: new Date().toISOString(),
          status: '확정',
        });

      if (applyError) {
        console.error('신청 실패:', applyError);
        setError('신청에 실패했습니다: ' + applyError.message);
        return;
      }

      // 신청 완료 화면으로
      setShowComplete(true);
    } catch (err) {
      console.error('신청 중 에러:', err);
      setError('신청 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 크레딧 조회
  const handleCheckCredits = async () => {
    if (!phone) {
      setError('전화번호를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const credits = await getUserCredits(phone);
      setUserCredits(credits);
      alert(`현재 잔여 크레딧: ${credits.toLocaleString()}원`);
    } catch (err) {
      console.error('크레딧 조회 실패:', err);
      setError('크레딧 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-grid-pattern flex flex-col items-center justify-center relative overflow-hidden font-body">
      {/* HUD 코너 장식 */}
      <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-neon-orange pointer-events-none" />
      <div className="absolute top-6 right-6 w-12 h-12 border-r-2 border-t-2 border-neon-orange pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-12 h-12 border-l-2 border-b-2 border-neon-orange pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-neon-orange pointer-events-none" />

      {/* 약관 모달 */}
      <AnimatePresence>
        {termsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
            onClick={() => setTermsModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-phantom-white border-2 border-neon-orange clip-cut-corner max-h-[85vh] w-full max-w-lg flex flex-col"
            >
              <div className="p-4 border-b-2 border-neon-orange/30 flex-shrink-0">
                <h3 className="font-orbitron text-sm font-bold text-neon-orange uppercase tracking-widest">
                  {termsModal === 'privacy' ? '개인정보 수집 및 이용 동의' : '마케팅 정보 수신 동의'}
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-text-main text-sm leading-relaxed whitespace-pre-line">
                {termsModal === 'privacy' ? PRIVACY_TERMS : MARKETING_TERMS}
              </div>
              <div className="p-4 flex-shrink-0 border-t-2 border-neon-orange/30">
                <button
                  type="button"
                  onClick={() => setTermsModal(null)}
                  className="w-full font-orbitron text-sm font-bold uppercase py-2.5 border-2 border-neon-orange bg-neon-orange text-text-light clip-cut-corner hover:shadow-neon-orange transition-shadow"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 실시간 예약 현황 모달 */}
      <AnimatePresence>
        {showAvailability && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
            onClick={() => setShowAvailability(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-phantom-white border-2 border-neon-orange clip-cut-corner max-h-[85vh] w-full max-w-2xl flex flex-col"
            >
              <div className="p-4 border-b-2 border-neon-orange/30 flex-shrink-0">
                <h3 className="font-orbitron text-lg font-bold text-neon-orange uppercase tracking-widest">
                  실시간 예약 현황
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {loadingSessions ? (
                  <p className="text-center text-text-sub font-share-tech-mono">로딩 중...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-center text-text-sub font-share-tech-mono">예약 가능한 세션이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.session_id}
                        className="border-2 border-neon-orange/30 clip-cut-corner p-4 bg-white/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-orbitron text-base font-bold text-text-main">
                              {session.game_name}
                            </h4>
                            <p className="font-share-tech-mono text-sm text-text-sub">
                              {session.session_id}
                            </p>
                          </div>
                          <span
                            className={`font-orbitron text-xs font-bold px-2 py-1 border clip-cut-corner ${
                              session.status === '모집중'
                                ? 'bg-neon-orange text-white border-neon-orange'
                                : 'bg-gray-400 text-white border-gray-400'
                            }`}
                          >
                            {session.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p className="font-share-tech-mono text-text-sub">
                            일시: {session.session_date} {session.session_time}
                          </p>
                          <p className="font-share-tech-mono text-text-sub">
                            참가비: {session.base_price.toLocaleString()}원
                          </p>
                          <p className="font-share-tech-mono text-text-sub">
                            현재 인원: {session.current_capacity} / {session.max_capacity}
                          </p>
                          <p className="font-share-tech-mono text-text-sub">
                            잔여 석: {session.available_slots}석
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 flex-shrink-0 border-t-2 border-neon-orange/30">
                <button
                  type="button"
                  onClick={() => setShowAvailability(false)}
                  className="w-full font-orbitron text-sm font-bold uppercase py-2.5 border-2 border-neon-orange bg-neon-orange text-text-light clip-cut-corner hover:shadow-neon-orange transition-shadow"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== 인트로 화면 (전원 ~ 텍스트 켜짐) ========== */}
      {!showSignUp && (
      <section className="relative flex flex-col items-center justify-center px-4 text-center z-10 w-full">
        {/* 1. 상단 문구 — 항상 밝게 */}
        <h1 className="font-orbitron text-xl md:text-2xl lg:text-3xl text-text-main font-bold tracking-[0.2em] mb-10 md:mb-14">
          당신의 두뇌 ON 하시겠습니까?
        </h1>

        {/* 2. DO : N E [전원 O] N   PROJECT — 두 번째 O가 전원 */}
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-1 md:gap-x-2 max-w-4xl">
            {/* D */}
            <motion.span
              className="font-orbitron text-3xl md:text-5xl lg:text-7xl font-black uppercase"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
                textShadow: isPowerOn
                  ? '0 0 12px rgba(255, 79, 0, 0.25), 0 0 24px rgba(255, 79, 0, 0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.25 : 0 }}
            >
              D
            </motion.span>
            {/* O (첫 번째 O) */}
            <motion.span
              className="font-orbitron text-3xl md:text-5xl lg:text-7xl font-black uppercase"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
                textShadow: isPowerOn
                  ? '0 0 12px rgba(255, 79, 0, 0.25), 0 0 24px rgba(255, 79, 0, 0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.28 : 0 }}
            >
              O
            </motion.span>
            {/* : */}
            <motion.span
              className="font-orbitron text-3xl md:text-5xl lg:text-7xl font-black uppercase"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.22 : 0 }}
            >
              :
            </motion.span>
            {/* N */}
            <motion.span
              className="font-orbitron text-3xl md:text-5xl lg:text-7xl font-black uppercase"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
                textShadow: isPowerOn
                  ? '0 0 12px rgba(255, 79, 0, 0.25), 0 0 24px rgba(255, 79, 0, 0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.32 : 0 }}
            >
              N
            </motion.span>
            {/* E */}
            <motion.span
              className="font-orbitron text-3xl md:text-5xl lg:text-7xl font-black uppercase"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
                textShadow: isPowerOn
                  ? '0 0 12px rgba(255, 79, 0, 0.25), 0 0 24px rgba(255, 79, 0, 0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.38 : 0 }}
            >
              E
            </motion.span>
            {/* 전원 버튼 — NEON의 두 번째 O, 항상 밝게 */}
            <div className="relative inline-flex mx-0.5">
              <motion.button
                type="button"
                onClick={handlePowerClick}
                disabled={isPowerOn}
                className="relative flex items-center justify-center p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2"
                whileHover={!isPowerOn ? { scale: 1.1 } : {}}
                whileTap={!isPowerOn ? { scale: 0.95 } : {}}
              >
                <Power
                  size={56}
                  strokeWidth={2.5}
                  className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 text-neon-orange drop-shadow-[0_0_12px_rgba(255,79,0,0.6)]"
                />
                {isPowerOn && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-neon-orange/20"
                    initial={{ scale: 0.8, opacity: 0.8 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                  />
                )}
              </motion.button>
            </div>
            {/* N */}
            <motion.span
              className="font-orbitron text-3xl md:text-5xl lg:text-7xl font-black uppercase"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
                textShadow: isPowerOn
                  ? '0 0 12px rgba(255, 79, 0, 0.25), 0 0 24px rgba(255, 79, 0, 0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.5 : 0 }}
            >
              N
            </motion.span>

            <span className="w-3 md:w-4" />

            {/* PROJECT */}
            <motion.span
              className="font-share-tech-mono text-2xl md:text-4xl lg:text-5xl font-bold uppercase tracking-widest"
              initial={false}
              animate={{
                color: isPowerOn ? '#222222' : '#666666',
                opacity: isPowerOn ? 1 : 0.08,
                textShadow: isPowerOn
                  ? '0 0 12px rgba(255, 79, 0, 0.25), 0 0 24px rgba(255, 79, 0, 0.15)'
                  : 'none',
              }}
              transition={{ duration: 0.5, delay: isPowerOn ? 0.6 : 0 }}
            >
              PROJECT
            </motion.span>
          </div>
        </div>

        {/* 전류 스윕 효과 — 전원 클릭 시 왼쪽에서 오른쪽으로 지나가는 선 */}
        <AnimatePresence>
          {isPowerOn && !sweepDone && (
            <motion.div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-orange to-transparent origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                style={{ boxShadow: '0 0 20px rgba(255, 79, 0, 0.8)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      )}

      {/* ========== 게임 신청 페이지 ========== */}
      <AnimatePresence mode="wait">
        {showSignUp && !showForm && (
          <motion.section
            key="signup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl mx-auto px-6 py-12 md:py-16 z-10"
          >
            {/* DO:LAB */}
            <p className="font-orbitron text-sm md:text-base font-bold tracking-[0.3em] text-neon-orange uppercase mb-1">
              DO:LAB
            </p>
            {/* NEON PROJECT */}
            <h1 className="font-orbitron text-2xl md:text-3xl lg:text-4xl font-black text-text-main tracking-tight mb-10 md:mb-12">
              NEON PROJECT
            </h1>

            {/* 소개 글 영역 — 6줄 정도 배치용 */}
            <div className="bg-deep-dark/5 border-2 border-neon-orange clip-cut-corner p-6 md:p-8 mb-8">
              <p className="font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-3">
                INTRODUCTION
              </p>
              <p className="text-text-main text-base md:text-lg leading-relaxed">
                소개 글
                <br />
                (여기에 소개 글이 6줄 정도 들어갈 예정입니다.)
                <br />
                <br />
                <br />
                <br />
                <br />
              </p>
            </div>

            {/* 금액 — 35,000 → 25,000 (28% 할인) */}
            <div className="flex flex-wrap items-baseline gap-3 mb-4">
              <span className="font-share-tech-mono text-text-sub text-lg line-through">
                35,000
              </span>
              <span className="font-orbitron text-2xl md:text-3xl font-black text-text-main">
                25,000
              </span>
              <span className="font-share-tech-mono text-neon-orange text-sm md:text-base font-bold uppercase">
                28% 할인
              </span>
            </div>
            {/* 게임 참가하기 버튼 — 클릭 시 참가자 정보 폼 화면으로 */}
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex font-orbitron text-lg md:text-xl font-bold uppercase tracking-[0.2em] py-3 px-6 border-2 border-neon-orange bg-neon-orange text-text-light clip-cut-corner transition-all duration-300 hover:shadow-neon-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2"
              >
                게임 참가하기
              </button>
              
              {/* 실시간 예약 확인 버튼 */}
              <button
                type="button"
                onClick={() => {
                  setShowAvailability(true);
                  loadAvailability();
                }}
                className="inline-flex font-orbitron text-base md:text-lg font-bold uppercase tracking-[0.2em] py-2.5 px-5 border-2 border-neon-orange bg-transparent text-neon-orange clip-cut-corner transition-all duration-300 hover:bg-neon-orange hover:text-text-light focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2"
              >
                실시간 예약 확인
              </button>
            </div>
          </motion.section>
        )}

        {/* ========== 참가자 정보 폼 Step 1 — 성명, 전화번호 ========== */}
        {showSignUp && showForm && !showFormStep2 && (
          <motion.section
            key="form-step1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl mx-auto px-6 py-12 md:py-16 z-10"
          >
            <p className="font-orbitron text-sm md:text-base font-bold tracking-[0.3em] text-neon-orange uppercase mb-1">
              DO:LAB
            </p>
            <h1 className="font-orbitron text-2xl md:text-3xl lg:text-4xl font-black text-text-main tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-share-tech-mono text-sm text-text-sub uppercase tracking-widest mb-8 md:mb-10">
              SEASON:0 베타 테스터 가입
            </p>

            <div className="space-y-6">
              {/* 성명 */}
              <div>
                <label htmlFor="name" className="block font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  성명
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="000"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full font-share-tech-mono text-text-main bg-transparent border-2 border-neon-orange clip-cut-corner py-3 px-4 placeholder:text-text-sub/60 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label htmlFor="phone" className="block font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  전화번호
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full font-share-tech-mono text-text-main bg-transparent border-2 border-neon-orange clip-cut-corner py-3 px-4 placeholder:text-text-sub/60 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0"
                />
              </div>
              
              {error && (
                <p className="font-share-tech-mono text-sm text-red-500">{error}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleStep1Continue}
              disabled={loading}
              className="mt-10 inline-flex font-orbitron text-lg md:text-xl font-bold uppercase tracking-[0.2em] py-3 px-6 border-2 border-neon-orange bg-neon-orange text-text-light clip-cut-corner transition-all duration-300 hover:shadow-neon-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '확인 중...' : '계속'}
            </button>
          </motion.section>
        )}

        {/* ========== 참가자 정보 폼 Step 2 — 닉네임, 패스워드, 약관 동의, 추천인 ========== */}
        {showSignUp && showForm && showFormStep2 && !showSchedule && (
          <motion.section
            key="form-step2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl mx-auto px-6 py-12 md:py-16 z-10"
          >
            <p className="font-orbitron text-sm md:text-base font-bold tracking-[0.3em] text-neon-orange uppercase mb-1">
              DO:LAB
            </p>
            <h1 className="font-orbitron text-2xl md:text-3xl lg:text-4xl font-black text-text-main tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-share-tech-mono text-sm text-text-sub uppercase tracking-widest mb-8 md:mb-10">
              SEASON:0 베타 테스터 가입
            </p>

            <div className="space-y-6">
              {/* 닉네임 */}
              <div>
                <label htmlFor="nickname" className="block font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  닉네임
                </label>
                <input
                  id="nickname"
                  type="text"
                  placeholder="000"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full font-share-tech-mono text-text-main bg-transparent border-2 border-neon-orange clip-cut-corner py-3 px-4 placeholder:text-text-sub/60 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0"
                />
              </div>

              {/* 패스워드(숫자 4자리) */}
              <div>
                <label htmlFor="password" className="block font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  패스워드(숫자 4자리)
                </label>
                <input
                  id="password"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full font-share-tech-mono text-text-main bg-transparent border-2 border-neon-orange clip-cut-corner py-3 px-4 placeholder:text-text-sub/60 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0"
                />
              </div>

              {/* 개인정보 수집 및 이용 동의(필수) */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="w-4 h-4 accent-neon-orange border-2 border-neon-orange rounded" 
                  />
                  <span className="font-share-tech-mono text-sm text-text-main">
                    개인정보 수집 및 이용 동의(필수)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setTermsModal('privacy')}
                  className="font-share-tech-mono text-xs text-neon-orange border border-neon-orange clip-cut-corner py-1.5 px-3 hover:bg-neon-orange hover:text-text-light transition-colors"
                >
                  약관확인
                </button>
              </div>

              {/* 마케팅 정보 동의(선택) */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="w-4 h-4 accent-neon-orange border-2 border-neon-orange rounded" 
                  />
                  <span className="font-share-tech-mono text-sm text-text-main">
                    마케팅 정보 동의(선택)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setTermsModal('marketing')}
                  className="font-share-tech-mono text-xs text-neon-orange border border-neon-orange clip-cut-corner py-1.5 px-3 hover:bg-neon-orange hover:text-text-light transition-colors"
                >
                  약관확인
                </button>
                <span className="font-share-tech-mono text-xs">
                  <span className="text-neon-orange font-bold">신규 유저 이벤트!</span>
                  <span className="text-black"> 최초 마케팅 동의 시 3천 크레딧 적립</span>
                </span>
              </div>

              {/* 추천인 — 전화번호(하이픈 제외) + 동료 테스터 이벤트 */}
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <label htmlFor="referrer" className="font-share-tech-mono text-xs text-text-sub uppercase tracking-widest">
                    추천인
                  </label>
                  <span className="font-share-tech-mono text-xs">
                    <span className="text-neon-orange font-bold">동료 테스터 초대 이벤트!</span>
                    <span className="text-black"> 신규 테스터가 가입할 경우, 추천인과 신규 테스터 모두 2천 크레딧 적립(추천인 코드는 추천인의 전화번호 입니다.)</span>
                  </span>
                </div>
                <input
                  id="referrer"
                  type="text"
                  inputMode="numeric"
                  placeholder="전화번호(하이픈 제외)"
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value.replace(/\D/g, ''))}
                  className="w-full font-share-tech-mono text-text-main bg-transparent border-2 border-neon-orange clip-cut-corner py-3 px-4 placeholder:text-text-sub/60 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0"
                />
              </div>
              
              {error && (
                <p className="font-share-tech-mono text-sm text-red-500">{error}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleStep2Continue}
              disabled={loading}
              className="mt-10 inline-flex font-orbitron text-lg md:text-xl font-bold uppercase tracking-[0.2em] py-3 px-6 border-2 border-neon-orange bg-neon-orange text-text-light clip-cut-corner transition-all duration-300 hover:shadow-neon-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '가입 중...' : '가입 및 신청하기'}
            </button>
          </motion.section>
        )}

        {/* ========== 참가 일정 / 크레딧 / 참가비 / 환불 동의 ========== */}
        {showSignUp && showForm && showSchedule && !showComplete && (
          <motion.section
            key="schedule"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl mx-auto px-6 py-12 md:py-16 z-10"
          >
            <p className="font-orbitron text-sm md:text-base font-bold tracking-[0.3em] text-neon-orange uppercase mb-1">
              DO:LAB
            </p>
            <h1 className="font-orbitron text-2xl md:text-3xl lg:text-4xl font-black text-text-main tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-share-tech-mono text-sm text-text-sub uppercase tracking-widest mb-8 md:mb-10">
              SEASON:0 베타 테스터 가입
            </p>

            <div className="space-y-6">
              {/* 참가 일정 */}
              <div>
                <label htmlFor="schedule" className="block font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  참가 일정
                </label>
                {loadingSessions ? (
                  <p className="font-share-tech-mono text-sm text-text-sub">로딩 중...</p>
                ) : (
                  <select
                    id="schedule"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full font-share-tech-mono text-text-main bg-white border-2 border-neon-orange clip-cut-corner py-3 px-4 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0 appearance-none bg-no-repeat bg-right pr-10"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23FF4F00\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")' }}
                  >
                    <option value="">-- 일정 선택 --</option>
                    {sessions.map((session) => (
                      <option key={session.session_id} value={session.session_id}>
                        {session.game_name} | {session.session_date} {session.session_time} | 잔여: {session.available_slots}석
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 크레딧 사용 + 잔여 크레딧 확인하기 */}
              <div>
                <label htmlFor="credit" className="block font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  크레딧 사용
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    id="credit"
                    type="text"
                    placeholder="0000"
                    value={creditUsed}
                    onChange={(e) => setCreditUsed(e.target.value.replace(/\D/g, ''))}
                    className="w-32 font-share-tech-mono text-text-main bg-transparent border-2 border-neon-orange clip-cut-corner py-3 px-4 placeholder:text-text-sub/60 focus:outline-none focus:ring-2 focus:ring-neon-orange focus:ring-offset-0"
                  />
                  <span className="text-text-sub">/</span>
                  <button
                    type="button"
                    onClick={handleCheckCredits}
                    disabled={loading}
                    className="font-share-tech-mono text-xs text-neon-orange border-2 border-neon-orange clip-cut-corner py-2.5 px-4 hover:bg-neon-orange hover:text-text-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    잔여 크레딧 확인하기
                  </button>
                </div>
                <p className="font-share-tech-mono text-sm text-text-sub">
                  현재 크레딧: {userCredits.toLocaleString()}원
                </p>
              </div>

              {/* 참가비 — 세션 금액에서 크레딧 사용분 뺀 금액 */}
              <div>
                <p className="font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  참가비
                </p>
                {selectedSession ? (
                  (() => {
                    const session = sessions.find(s => s.session_id === selectedSession);
                    const basePrice = session?.base_price || 25000;
                    const credits = Number(creditUsed) || 0;
                    const finalPrice = Math.max(0, basePrice - credits);
                    return (
                      <p className="font-orbitron text-lg text-text-main">
                        {basePrice.toLocaleString()} - {credits.toLocaleString()}(크레딧) = {finalPrice.toLocaleString()}원
                      </p>
                    );
                  })()
                ) : (
                  <p className="font-orbitron text-lg text-text-sub">일정을 먼저 선택해주세요</p>
                )}
              </div>

              {/* 환불 규정 동의(필수) */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={refundConsent}
                    onChange={(e) => setRefundConsent(e.target.checked)}
                    className="w-4 h-4 accent-neon-orange border-2 border-neon-orange rounded" 
                  />
                  <span className="font-share-tech-mono text-sm text-text-main">
                    환불 규정 동의(필수)
                  </span>
                </label>
                <button
                  type="button"
                  className="font-share-tech-mono text-xs text-neon-orange border border-neon-orange clip-cut-corner py-1.5 px-3 hover:bg-neon-orange hover:text-text-light transition-colors"
                >
                  약관확인
                </button>
              </div>

              {/* 설명 칸 — 입금 조건, 입금 등 3줄 배치 */}
              <div className="bg-deep-dark/5 border-2 border-neon-orange clip-cut-corner p-4 md:p-5">
                <p className="font-share-tech-mono text-xs text-text-sub uppercase tracking-widest mb-2">
                  입금 안내
                </p>
                <p className="text-text-main text-sm leading-relaxed">
                  참가비는 아래 계좌로 입금해주세요.<br />
                  은행: 카카오뱅크 | 예금주: DO:LAB<br />
                  입금 확인 후 참가가 최종 확정됩니다.
                </p>
              </div>
              
              {error && (
                <p className="font-share-tech-mono text-sm text-red-500">{error}</p>
              )}
            </div>

            {/* 참가 신청 완료 — 클릭 시 완료 화면으로 */}
            <button
              type="button"
              onClick={handleApplyComplete}
              disabled={loading}
              className="mt-10 inline-flex font-orbitron text-lg md:text-xl font-bold uppercase tracking-[0.2em] py-3 px-6 border-2 border-neon-orange bg-neon-orange text-text-light clip-cut-corner transition-all duration-300 hover:shadow-neon-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-orange focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '신청 중...' : '참가 신청 완료'}
            </button>
          </motion.section>
        )}

        {/* ========== 신청 완료 화면 ========== */}
        {showSignUp && showForm && showSchedule && showComplete && (
          <motion.section
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl mx-auto px-6 py-12 md:py-16 z-10 text-center"
          >
            <p className="font-orbitron text-sm md:text-base font-bold tracking-[0.3em] text-neon-orange uppercase mb-6">
              DO:LAB · NEON PROJECT
            </p>
            <h2 className="font-orbitron text-2xl md:text-3xl font-black text-text-main tracking-tight mb-4">
              신청이 완료되었습니다.
            </h2>
            <p className="font-body text-xl md:text-2xl text-text-main font-medium">
              환영합니다, 테스터 님.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
