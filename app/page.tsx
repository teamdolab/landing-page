'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Info, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { IntroScreen } from '@/app/_components/landing/IntroScreen';
import { usePostHog } from 'posthog-js/react';
import { gtagEvent } from '@/lib/analytics';

const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_nVsZX'; // DO:LAB 카카오톡 채널
import { 
  supabase, 
  checkUserExists,
  verifyUserPassword,
  verifyReferrerExists, 
  getSessionAvailability, 
  getUserCredits,
  type UserInfo,
  type SessionAvailability 
} from '@/lib/supabase';

const PRIVACY_TERMS = `개인정보 수집 및 이용 동의 (필수)

제1조 (수집 및 이용 목적)
TEAM DO:LAB 대표자 김석원(이하 'DO:LAB')은 NEON PROJECT 테스터 가입 및 오프라인 행사 진행을 위해 아래와 같이 개인정보를 수집·이용합니다.

• 테스터 관리: 본인 확인, 크레딧 서비스 제공, 불량 테스터의 부정이용 방지
• 행사 운영: 참가 신청 접수, 예약 확정 및 취소 안내, 현장 입장 확인
• 고객 지원: 문의 사항 처리

제2조 (수집하는 항목)
• 필수 항목: 성명, 휴대전화번호

제3조 (보유 및 이용 기간)
수집된 개인정보는 테스터 탈퇴 시까지 보관 및 이용됩니다. 단, 관계 법령 및 내부 방침에 의하여 보존할 필요가 있는 경우 아래의 기간 동안 보관합니다.

• 소비자의 불만 또는 분쟁 처리에 관한 기록: 3년
• 대금 결제 및 행사 참가(재화 등의 공급)에 관한 기록: 5년

제4조 (동의 거부 권리 및 불이익)
귀하는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다. 단, 필수 항목 동의를 거부할 경우 테스터 가입 및 오프라인 행사(게임) 참가 신청이 불가능합니다.

[유의사항 : 크레딧 및 환불 정책]
• 크레딧 성격: 적립된 '크레딧'은 DO:LAB 서비스 내에서만 사용 가능한 비현금성 포인트이며, 어떠한 경우에도 현금으로 환급되지 않습니다.
• 소멸: 회원 탈퇴 시 보유 크레딧은 즉시 소멸되며 복구되지 않습니다.
• 회수: 부정한 방법(중복 가입, 허위 추천 등)으로 획득한 크레딧은 사전 통보 없이 전액 회수될 수 있습니다.

※ 회원 탈퇴 및 마케팅 수신 동의 철회는 DO:LAB 카카오톡 채널을 통해 요청하실 수 있습니다.`;

const MARKETING_TERMS = `마케팅 정보 수신 및 혜택 알림 동의 (선택)

제1조 (수집 및 이용 목적)
TEAM DO:LAB 대표자 김석원은 수집한 개인정보를 다음의 마케팅 및 프로모션 목적을 위해 활용합니다.

• DO:LAB의 신규 프로젝트(시즌), 이벤트 안내 (SMS/알림톡 등)
• 테스터 혜택(크레딧, 할인 쿠폰, 우선 예약권 등) 지급 및 관리
• 맞춤형 정보 전송 및 신규 테스트(게임) 참여 기회 우선 제공

제2조 (수집 항목)
성명, 휴대전화번호

제3조 (보유 및 이용 기간)
테스터 탈퇴 또는 마케팅 수신 동의 철회 시까지

제4조 (동의 거부 권리 및 불이익)
귀하는 마케팅 정보 수신에 대한 동의를 거부할 권리가 있습니다. 동의하지 않더라도 기본 서비스(게임 예약 및 참가) 이용에는 전혀 제한이 없으나, 마케팅 수신 동의자에게만 제공되는 특별 혜택(크레딧 적립, 할인 쿠폰, 게임 우선 초대 등)은 제공 받으실 수 없습니다.

※ 회원 탈퇴 및 마케팅 수신 동의 철회는 DO:LAB 카카오톡 채널을 통해 언제든지 요청하실 수 있습니다.`;

const REFUND_TERMS = `환불 규정

제1조 (환불의 원칙)
DO:LAB의 모든 프로젝트(오프라인 게임)는 다수의 테스터가 정해진 시간에 함께 참여하는 구조이므로, 원활한 진행을 위해 취소 시점에 따라 아래와 같이 위약금이 발생합니다.

• 게임 진행일 5일 전까지: 참가비 전액 환불 (100%)
• 게임 진행일 2~4일 전까지: 참가비 결제 금액의 50% 환불
• 게임 진행일 1일 전 및 당일 취소: 환불 불가 (0%)

(※ 자정을 기준으로 합니다. 예를 들어 토요일 게임을 취소할 경우, 해당 주의 월요일 23:59까지 취소한 건에 대해 참가비를 전액 환불해드립니다.)

제2조 (지각 및 노쇼(No-Show) 규정)
• 게임 정시에 시작되며, 룰 설명 및 게임의 완벽한 몰입도를 위해 시작 시간 기준 10분 후 부터는 입장이 절대 불가합니다.
• 지각으로 인해 입장이 제한되거나, 사전 연락 없이 불참(노쇼)하는 경우 참가비는 전액 환불되지 않습니다.

제3조 (참가권의 양도)
• 부득이한 사정으로 본인이 참석할 수 없는 경우, 타인에게 참가권을 양도할 수 있습니다.
• 단, 참가권 양도 시 반드시 게임 시작 최소 12시간 전까지 DO:LAB 카카오톡 채널을 통해 양수자의 정보(성명, 연락처)를 전달하여 사전 승인을 받아야 합니다.

제4조 (DO:LAB 사정에 의한 취소 및 환불)
• 각 게임 별 최소 진행 인원(8명)이 모이지 않을 경우, 게임은 취소됩니다.
• 인원 미달, 천재지변, 운영자 측의 불가피한 사정으로 인해 게임이 취소되는 경우, 참가비 전액(100%)을 환불해드립니다.

제5조 (크레딧 환불 불가)
• 이전 약관에 명시된 바와 같이, 현금 결제가 아닌 '크레딧(DO:LAB 자체 포인트)'으로 참가비를 결제한 경우, 취소 시 현금으로 환불되지 않으며 규정에 따른 비율만큼 크레딧으로 반환됩니다.`;

/** 게임 소개 모달 제목 (구버전 state 키 호환) */
function getGameIntroDisplayTitle(key: string): string {
  if (key === 'GAME 0B' || key.toLowerCase() === 'game 0b') return '수송선게임';
  return key;
}

function isSusongseonGameIntro(key: string): boolean {
  return key === '수송선게임' || key === 'GAME 0B' || key.toLowerCase() === 'game 0b';
}

export default function Home() {
  const posthog = usePostHog();

  const track = (name: string, props?: Record<string, unknown>) => {
    gtagEvent(name, props);
    posthog?.capture(name, props);
  };

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
  const [termsModal, setTermsModal] = useState<'privacy' | 'marketing' | 'refund' | null>(null);
  // 게임 소개 모달
  const [showGameIntro, setShowGameIntro] = useState<string | null>(null);
  // 이벤트 모달
  const [showEventModal, setShowEventModal] = useState<'newuser' | 'referrer' | null>(null);
  // 장소 / 콘텐츠 소개 모달
  const [showInfoModal, setShowInfoModal] = useState<'venue' | 'content' | null>(null);
  // 가입 확인 모달 (신규 회원)
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  
  // 로딩 및 에러
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 전화번호: 하이픈/공백 제거, 숫자만
  const normalizePhone = (p: string) => p.replace(/\D/g, '');

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

  // Step 1: 성명 + 전화번호로 유저 확인
  const handleStep1Continue = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('성명과 전화번호를 입력해주세요.');
      return;
    }
    const phoneNum = normalizePhone(phone);
    if (phoneNum.length < 10) {
      setError('올바른 전화번호를 입력해주세요. (10~11자리)');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await checkUserExists(name, phoneNum);
      
      if (result.user_exists) {
        // 기존 유저 - Step 2로 이동 (패스워드 입력)
        setIsExistingUser(true);
        setUserId(result.user_id);
        setNickname(result.nickname || '');
        setUserCredits(result.credits);
        setShowFormStep2(true);
      } else {
        // 신규 유저 - Step 2로 이동 (가입 정보 입력)
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

  // Step 2: 신규 유저 가입 OR 기존 유저 로그인
  const handleStep2Continue = async () => {
    // 기존 유저인 경우: 패스워드 확인
    if (isExistingUser) {
      if (!userId) {
        setError('유저 정보를 다시 확인해주세요.');
        return;
      }
      if (!password || password.length !== 4) {
        setError('4자리 패스워드를 입력해주세요.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        // 패스워드 확인 (RPC 사용 - RLS 적용 시 user_info 직접 조회 불가)
        const user = await verifyUserPassword(userId, password);

        if (!user) {
          setError('패스워드가 일치하지 않습니다.');
          setLoading(false);
          return;
        }

        // 로그인 성공 - 참가 신청 페이지로
        setUserCredits(user.credits);
        posthog?.identify(String((user as { id?: unknown }).id ?? userId));
        await loadSessionsForSchedule();
        setShowForm(true);
        setShowSchedule(true);
        track('payment_view');
      } catch (err) {
        console.error('로그인 실패:', err);
        setError('로그인에 실패했습니다.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 신규 유저인 경우: 유효성 검사 후 확인 모달 표시
    if (!nickname.trim() || !password || password.length !== 4) {
      setError('닉네임과 4자리 패스워드를 입력해주세요.');
      return;
    }

    if (!privacyConsent) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

    // 추천인 입력 시 유효성 검사 (기존 회원 전화번호인지 확인, RPC 사용)
    if (referrer.trim()) {
      const referrerNum = normalizePhone(referrer);
      if (referrerNum.length < 10) {
        setError('올바른 추천인 번호가 아닙니다.');
        return;
      }
      if (referrerNum === normalizePhone(phone)) {
        setError('본인 전화번호는 추천인으로 입력할 수 없습니다.');
        return;
      }
      const refExists = await verifyReferrerExists(referrerNum);
      if (!refExists) {
        setError('올바른 추천인 번호가 아닙니다.');
        return;
      }
    }

    // 가입 확인 모달 표시
    setShowSignupConfirm(true);
  };

  // 신규 회원 가입 실행 (확인 모달에서 예 클릭 시)
  const handleSignupConfirm = async () => {
    setShowSignupConfirm(false);
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: normalizePhone(phone),
          nickname,
          password,
          privacy_consent: privacyConsent,
          marketing_consent: marketingConsent,
          referrer_phone: referrer ? normalizePhone(referrer) : null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || '가입에 실패했습니다.');
        return;
      }

      if (result.id) {
        setUserId(result.id);
        setUserCredits(result.credits ?? 0);
        posthog?.identify(String(result.id));
      }

      await loadSessionsForSchedule();
      setShowForm(true);
      setShowSchedule(true);
      track('payment_view');
    } catch (err) {
      console.error('가입 중 에러:', err);
      setError('가입 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
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
    if (usedCreditsNum % 1000 !== 0) {
      setError('크레딧은 1,000 단위로만 사용 가능합니다.');
      return;
    }
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
          status: '신청중',
        });

      if (applyError) {
        console.error('신청 실패:', applyError);
        const isDuplicate = applyError.code === '23505' || applyError.message?.includes('apply_user_id_session_id_key');
        setError(isDuplicate ? '이미 신청한 게임입니다.' : '죄송합니다. 신청에 실패했습니다. 잠시 후 다시 시도해주시거나, DO:LAB 카카오톡 채널로 문의주시기 바랍니다.');
        return;
      }

      // 신청 완료 화면으로
      setShowComplete(true);
      track('apply_complete', { session_id: selectedSession });
    } catch (err) {
      console.error('신청 중 에러:', err);
      setError('죄송합니다. 신청에 실패했습니다. 잠시 후 다시 시도해주시거나, DO:LAB 카카오톡 채널로 문의주시기 바랍니다.');
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
      const credits = await getUserCredits(normalizePhone(phone));
      setUserCredits(credits);
      alert(`현재 잔여 크레딧: ${credits.toLocaleString()}`);
    } catch (err) {
      console.error('크레딧 조회 실패:', err);
      setError('크레딧 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 뒤로가기 핸들러
  const handleGoBack = () => {
    if (showComplete) {
      // 완료 화면에서 뒤로가기 - 처음부터
      window.location.reload();
    } else if (showSchedule) {
      // 참가 신청 페이지에서 뒤로가기
      setShowSchedule(false);
      if (isExistingUser) {
        // 기존 유저면 Step 1로
        setShowForm(false);
        setShowFormStep2(false);
      } else {
        // 신규 유저면 Step 2로
        setShowFormStep2(true);
      }
    } else if (showFormStep2) {
      // Step 2에서 뒤로가기 - Step 1로
      setShowFormStep2(false);
    } else if (showForm) {
      // Step 1에서 뒤로가기 - 전원 끄기
      setShowForm(false);
      setShowSignUp(false);
      // 폼 초기화
      setName('');
      setPhone('');
      setNickname('');
      setPassword('');
      setPrivacyConsent(false);
      setMarketingConsent(false);
      setReferrer('');
      setSelectedSession('');
      setCreditUsed('');
      setRefundConsent(false);
      setError('');
    }
  };

  return (
    <main className="min-h-screen bg-grid-v12 flex flex-col items-center justify-center relative overflow-hidden font-body">

      {/* 약관 모달 */}
      <AnimatePresence>
        {termsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/60"
            onClick={() => setTermsModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-line clip-chamfer max-h-[85vh] w-full max-w-lg flex flex-col"
            >
              <div className="p-4 border-b border-line flex-shrink-0">
                <h3 className="font-mono text-xs font-bold text-signal uppercase tracking-widest">
                  {termsModal === 'privacy' ? '개인정보 수집 및 이용 동의' : termsModal === 'marketing' ? '마케팅 정보 수신 동의' : '환불 규정'}
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-ink text-sm leading-relaxed whitespace-pre-line">
                {termsModal === 'privacy' ? PRIVACY_TERMS : termsModal === 'marketing' ? MARKETING_TERMS : REFUND_TERMS}
              </div>
              <div className="p-4 flex-shrink-0 border-t border-line">
                <button
                  type="button"
                  onClick={() => setTermsModal(null)}
                  className="w-full btn-signal"
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
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/60"
            onClick={() => setShowAvailability(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-line clip-chamfer max-h-[85vh] w-full max-w-2xl flex flex-col"
            >
              <div className="p-4 border-b border-line flex-shrink-0">
                <h3 className="font-mono text-lg font-bold text-signal uppercase tracking-widest">
                  실시간 예약 현황
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {loadingSessions ? (
                  <p className="text-center text-ink-2 font-body">로딩 중...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-center text-ink-2 font-body">예약 가능한 세션이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => {
                      const isClosed = session.status === '마감' || session.available_slots === 0;
                      const displayStatus = isClosed ? '마감' : (session.current_capacity >= 8 ? '진행확정' : '모집중');
                      return (
                        <div
                          key={session.session_id}
                          className={`clip-chamfer p-4 border transition-all duration-base ${
                            isClosed
                              ? 'border-line bg-paper-2 opacity-60'
                              : 'border-line bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className={`font-display text-base font-bold ${isClosed ? 'text-gray-500' : 'text-ink'}`}>
                                {session.game_name}
                              </h4>
                            </div>
                            <span
                              className={`font-mono text-xs font-bold px-2 py-1 border clip-chamfer ${
                                displayStatus === '진행확정'
                                  ? 'bg-signal text-white border-signal'
                                  : displayStatus === '모집중'
                                  ? 'bg-ink text-white border-ink'
                                  : 'bg-gray text-white border-gray'
                              }`}
                            >
                              {displayStatus}
                            </span>
                          </div>
                          <div className={`grid grid-cols-2 gap-2 text-sm ${isClosed ? 'text-gray-400' : 'text-ink-2'}`}>
                            <p className="font-body">
                              일시: {session.session_date} {(() => {
                                const start = session.session_time?.slice(0, 5) || '';
                                if (!start) return '';
                                const [h, m] = start.split(':').map(Number);
                                const endMin = h * 60 + m + 150;
                                const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
                                const endM = String(endMin % 60).padStart(2, '0');
                                return `${start}-${endH}:${endM}`;
                              })()}
                            </p>
                            <p className="font-body">
                              참가비: {session.base_price.toLocaleString()}원
                            </p>
                            <p className="font-body">
                              현재 인원: {session.current_capacity} / {session.max_capacity}
                            </p>
                            <p className="font-body">
                              잔여 석: <span className={`font-bold ${isClosed ? 'text-gray-400' : 'text-ink'}`}>{session.available_slots}</span>석
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 flex-shrink-0 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAvailability(false)}
                  className="w-full btn-signal"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 게임 소개 모달 */}
      <AnimatePresence>
        {showGameIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/60"
            onClick={() => setShowGameIntro(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-line clip-chamfer max-h-[85vh] w-full max-w-lg flex flex-col"
            >
              <div className="p-4 border-b border-line flex-shrink-0">
                <h3 className="font-mono text-xs font-bold text-signal tracking-widest normal-case">
                  {showGameIntro ? getGameIntroDisplayTitle(showGameIntro) : ''}
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-ink text-sm leading-relaxed whitespace-pre-line">
                {showGameIntro === '대선 포커' ? (
                  <>
                    유권자가 되어 판을 움직일 것인가,{'\n'}
                    후보가 되어 승리를 쟁취할 것인가.{'\n'}
                    당신은 상대의 말을 믿을 수 있습니까?{'\n\n'}
                    <span className="font-bold">&quot;출마, 하겠습니다.&quot;</span>{'\n\n'}
                    플레이 타임: 150분{'\n'}
                    장르: 정치, 전략, 포커
                  </>
                ) : showGameIntro && isSusongseonGameIntro(showGameIntro) ? (
                  <>
                    2126년, 지구는 외계인 침공과 방사능 노출로 인해 더 이상 살 수 없는 행성이 되었다.{'\n'}
                    남은 인류는 겨우 10명 남짓. 그리고 탈출을 위한 무너져가는 수송선 1개.{'\n'}
                    수송선의 탑승 인원은 정해져 있는데...{'\n'}
                    과연 누가 수송선에 탑승하여 탈출할 것인가?{'\n\n'}
                    <span className="font-bold">&quot;설명할 시간이 없어, 어서 타!&quot;</span>
                    {'\n\n'}
                    장르: 마피아, SF, 전략
                  </>
                ) : (
                  ''
                )}
              </div>
              <div className="p-4 flex-shrink-0 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowGameIntro(null)}
                  className="w-full btn-signal"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 / 콘텐츠 정보 모달 */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/60"
            onClick={() => setShowInfoModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-line clip-chamfer max-h-[85vh] w-full max-w-lg flex flex-col"
            >
              <div className="p-4 border-b border-line flex-shrink-0">
                <h3 className="font-mono text-xs font-bold text-signal uppercase tracking-widest">
                  {showInfoModal === 'venue' ? '장소' : '콘텐츠 정보'}
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-ink text-sm leading-relaxed">
                {showInfoModal === 'venue' && (
                  <>
                    <p>우비공 문래(영등포구 도림로 147길 22, 2층)</p>
                    <p className="text-xs text-ink-2 mt-2">* 추후 변경 될 수 있습니다.</p>
                  </>
                )}
                {showInfoModal === 'content' && (
                  <>
                    <p className="font-display text-xs font-bold text-signal uppercase tracking-widest mb-2">소개</p>
                    <p className="mb-4">
                      소셜전략게임 연구소 DO:LAB에서 진행하는 게임을 만나보세요!
                      <br />
                      예능에서만 보던 더지니어스, 데블스플랜 등의 게임을 실제로 플레이하실 수 있습니다.
                      <br />
                      마피아 게임, 보드 게임, 전략 게임, 방탈출을 좋아하는 모든 분들을 환영합니다.
                      <br />
                      <br />
                      당신의 두뇌, ON 시킬 준비되셨습니까?
                      <br />
                      지금 바로 신청하세요! &quot;DO:NEON PROJECT&quot;
                    </p>
                    <p className="font-display text-xs font-bold text-signal uppercase tracking-widest mb-2">유의사항</p>
                    <p>
                      DO:LAB의 모든 게임은 최소 진행 인원이 8명입니다. 최소 진행 인원이 플레이 당일 자정(00시 00분)까지 8명 미만일 경우 게임은 취소되며, 전액 환불해드립니다.
                    </p>
                  </>
                )}
              </div>
              <div className="p-4 flex-shrink-0 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(null)}
                  className="w-full btn-signal"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 이벤트 모달 */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/60"
            onClick={() => setShowEventModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-line clip-chamfer max-h-[85vh] w-full max-w-lg flex flex-col"
            >
              <div className="p-4 border-b border-line flex-shrink-0">
                <h3 className="font-mono text-xs font-bold text-signal uppercase tracking-widest">
                  EVENT!
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 text-ink text-sm leading-relaxed">
                {showEventModal === 'newuser' && (
                  <p>
                    신규 테스터 등록 시 마케팅 정보 동의할 경우, 3,000 크레딧을 적립해드립니다!
                    <br />
                    적립된 크레딧은 즉시 사용 가능합니다.
                  </p>
                )}
                {showEventModal === 'referrer' && (
                  <p>
                    신규 테스터 등록 시 추천인을 입력할 경우, 추천인과 신규 테스터 모두 2,000 크레딧을 적립해드립니다!
                    <br />
                    (추천인 코드는 기존 테스터의 전화번호 입니다.)
                    <br />
                    적립된 크레딧은 즉시 사용 가능합니다.
                  </p>
                )}
              </div>
              <div className="p-4 flex-shrink-0 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowEventModal(null)}
                  className="w-full btn-signal"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 가입 확인 모달 (신규 회원) */}
      <AnimatePresence>
        {showSignupConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/60"
            onClick={() => setShowSignupConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-line clip-chamfer max-w-lg w-full flex flex-col"
            >
              <div className="p-4 border-b border-line flex-shrink-0">
                <h3 className="font-mono text-xs font-bold text-signal uppercase tracking-widest">
                  가입 확인
                </h3>
              </div>
              <div className="p-4 flex-1 text-ink text-sm leading-relaxed">
                <p>
                  <span className="font-bold">{nickname}#{normalizePhone(phone).slice(-4) || '****'}</span>
                  으로 등록하시겠습니까?
                </p>
                <p className="mt-2 text-xs text-ink-2/80">
                  (#은 PIN 번호이며, 전화번호 뒷자리로 자동 설정됩니다.)
                </p>
              </div>
              <div className="p-4 flex-shrink-0 border-t border-line flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSignupConfirm(false)}
                  className="flex-1 btn-signal-outline"
                >
                  아니오
                </button>
                <button
                  type="button"
                  onClick={handleSignupConfirm}
                  className="flex-1 btn-signal"
                >
                  예
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSignUp && (
        <IntroScreen onComplete={() => setShowSignUp(true)} />
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
            <p className="font-mono text-xs text-signal uppercase tracking-[0.3em] mb-1">
              DO:LAB
            </p>
            <h1 className="font-display text-3xl font-bold text-ink tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-mono text-xs text-ink-2 uppercase tracking-widest mb-8">
              SEASON: 0
            </p>

            <div className="signup-panel p-6 md:p-8 mb-8">
              <p className="font-body text-base text-ink leading-[1.7] mb-4">
                신인류 프로젝트, <span className="font-bold">DO:NEON PROJECT(두뇌ON 프로젝트)</span>가 시작됩니다.
                <br />
                신뢰를 쌓고 함께 승리를 만들어낼 것인지,
                <br />
                마지막 순간 배신으로 판을 뒤집을 것인지,
                <br />
                혹은 누구의 도움도 없이 끝까지 살아남을 것인지.
              </p>
              <p className="font-body text-md font-bold text-ink mb-6">
                당신은 어떤 선택을 하시겠습니까?
              </p>
              <div className="border-t border-line pt-6">
                <p className="font-mono text-xs text-signal uppercase tracking-widest mb-4">
                  시즌 0 게임
                </p>
                <div className="flex flex-wrap gap-5">
                  <figure className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowGameIntro('대선 포커')}
                      className="game-card-signup"
                      style={{ ['--ga' as string]: '#E23B4E' }}
                    >
                      <img
                        src="/daesun-poker-poster.png"
                        alt="대선 포커"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <span className="absolute inset-0 hidden items-center justify-center bg-white/80 font-body text-sm font-bold text-ink">
                        대선 포커
                      </span>
                    </button>
                    <figcaption className="mt-2 text-sm font-body font-bold text-ink text-center max-w-[6rem]">
                      대선 포커
                    </figcaption>
                  </figure>
                  <figure className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowGameIntro('수송선게임')}
                      className="game-card-signup"
                      style={{ ['--ga' as string]: '#6B46D9' }}
                    >
                      <img
                        src="/susongseon-game-poster.png"
                        alt="수송선게임"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (el.dataset.tryLegacy !== '1') {
                            el.dataset.tryLegacy = '1';
                            el.src = '/game-0b-poster.png';
                            return;
                          }
                          el.style.display = 'none';
                          const fallback = el.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <span className="absolute inset-0 hidden flex-col items-center justify-center gap-1 bg-ink/85 px-1 text-center font-body text-sm font-bold text-white">
                        수송선게임
                      </span>
                    </button>
                    <figcaption className="mt-2 text-sm font-body font-bold text-ink text-center max-w-[6rem]">
                      수송선게임
                    </figcaption>
                  </figure>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 mb-5">
              <span className="font-body text-sm text-gray line-through">35,000</span>
              <span className="font-mono text-2xl font-bold text-ink">25,000</span>
              <span className="price-tag-v12">28% 할인</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-8">
              <button
                type="button"
                onClick={() => setShowInfoModal('venue')}
                className="signup-meta-link"
              >
                <MapPin size={16} strokeWidth={2} className="text-ink-2" />
                장소
              </button>
              <button
                type="button"
                onClick={() => setShowInfoModal('content')}
                className="signup-meta-link"
              >
                <Info size={16} strokeWidth={2} className="text-ink-2" />
                콘텐츠 정보
              </button>
              <a
                href={KAKAO_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="signup-meta-link"
              >
                <MessageCircle size={16} strokeWidth={2} className="text-ink-2" />
                카카오톡 채널 문의하기
              </a>
            </div>

            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowAvailability(true);
                  loadAvailability();
                }}
                className="btn-signal-outline w-full sm:w-auto"
              >
                실시간 예약 확인
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(true); track('apply_start'); }}
                className="btn-signal w-full sm:w-auto"
              >
                게임 참가하기
              </button>
            </div>
          </motion.section>
        )}

        {/* ========== 참가자 정보 폼 Step 1 — 성명, 전화번호 ========== */}
        {showSignUp && showForm && !showFormStep2 && !showSchedule && (
          <motion.section
            key="form-step1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full max-w-2xl mx-auto px-6 py-12 md:py-16 z-10"
          >
            {/* 뒤로가기 버튼 */}
            <button
              type="button"
              onClick={handleGoBack}
              className="mb-4 font-display text-sm text-signal hover:text-signal/80 uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              ← 뒤로가기
            </button>

            <p className="font-display text-sm md:text-base font-bold tracking-[0.3em] text-signal uppercase mb-1">
              DO:LAB
            </p>
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-black text-ink tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-body text-sm text-ink-2 uppercase tracking-widest mb-8 md:mb-10">
              SEASON: 0
            </p>

            <div className="space-y-6">
              {/* 성명 */}
              <div>
                <label htmlFor="name" className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                  성명
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="김네온"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-v12"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label htmlFor="phone" className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                  전화번호
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="input-v12"
                />
              </div>
              
              {error && (
                <p className="font-body text-sm text-red-500">{error}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleStep1Continue}
              disabled={loading}
              className="mt-10 btn-signal text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
            {/* 뒤로가기 버튼 */}
            <button
              type="button"
              onClick={handleGoBack}
              className="mb-4 font-display text-sm text-signal hover:text-signal/80 uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              ← 뒤로가기
            </button>

            <p className="font-display text-sm md:text-base font-bold tracking-[0.3em] text-signal uppercase mb-1">
              DO:LAB
            </p>
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-black text-ink tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-body text-sm text-ink-2 uppercase tracking-widest mb-8 md:mb-10">
              {isExistingUser ? '로그인' : 'SEASON: 0'}
            </p>

            <div className="space-y-6">
              {/* 기존 회원: 닉네임 표시 (읽기 전용) */}
              {isExistingUser && (
                <div>
                  <label className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                    닉네임
                  </label>
                  <div className="w-full input-v12 bg-paper-2">
                    {nickname}
                  </div>
                </div>
              )}

              {/* 신규 회원: 닉네임 입력 */}
              {!isExistingUser && (
                <div>
                  <label htmlFor="nickname" className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                    닉네임
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    placeholder="(한글 2-6자)"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="input-v12"
                  />
                </div>
              )}

              {/* 패스워드(숫자 4자리) */}
              <div>
                <label htmlFor="password" className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
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
                  className="input-v12"
                />
              </div>

              {/* 신규 회원만: 개인정보 동의, 마케팅 동의, 추천인 */}
              {!isExistingUser && (
                <>
                  {/* 개인정보 수집 및 이용 동의(필수) */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={privacyConsent}
                        onChange={(e) => setPrivacyConsent(e.target.checked)}
                        className="w-4 h-4 accent-signal border border-signal clip-chamfer" 
                      />
                      <span className="font-body text-sm text-ink">
                        개인정보 수집 및 이용 동의(필수)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setTermsModal('privacy')}
                      className="font-body text-xs text-signal border border-signal clip-chamfer py-1.5 px-3 hover:bg-signal hover:text-white transition-colors"
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
                        className="w-4 h-4 accent-signal border border-signal clip-chamfer" 
                      />
                      <span className="font-body text-sm text-ink">
                        마케팅 정보 동의(선택)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setTermsModal('marketing')}
                      className="font-body text-xs text-signal border border-signal clip-chamfer py-1.5 px-3 hover:bg-signal hover:text-white transition-colors"
                    >
                      약관확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEventModal('newuser')}
                      className="font-body text-xs text-signal font-bold cursor-pointer hover:underline"
                    >
                      EVENT!
                    </button>
                  </div>

                  {/* 추천인 — 전화번호(하이픈 제외) */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <label htmlFor="referrer" className="font-body text-xs text-ink-2 uppercase tracking-widest">
                        추천인
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEventModal('referrer')}
                        className="font-body text-xs text-signal font-bold cursor-pointer hover:underline"
                      >
                        EVENT!
                      </button>
                    </div>
                    <input
                      id="referrer"
                      type="text"
                      inputMode="numeric"
                      placeholder="01012345678"
                      value={referrer}
                      onChange={(e) => setReferrer(e.target.value.replace(/\D/g, ''))}
                      className="input-v12"
                    />
                  </div>
                </>
              )}
              
              {error && (
                <p className="font-body text-sm text-red-500">{error}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleStep2Continue}
              disabled={loading}
              className="mt-10 btn-signal text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isExistingUser ? '로그인 중...' : '가입 중...') : (isExistingUser ? '로그인' : '가입 및 신청하기')}
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
            {/* 뒤로가기 버튼 */}
            <button
              type="button"
              onClick={handleGoBack}
              className="mb-4 font-display text-sm text-signal hover:text-signal/80 uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              ← 뒤로가기
            </button>

            <p className="font-display text-sm md:text-base font-bold tracking-[0.3em] text-signal uppercase mb-1">
              DO:LAB
            </p>
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-black text-ink tracking-tight mb-1">
              NEON PROJECT
            </h1>
            <p className="font-body text-sm text-ink-2 uppercase tracking-widest mb-8 md:mb-10">
              SEASON: 0
            </p>

            <div className="space-y-6">
              {/* 참가 일정 */}
              <div>
                <label htmlFor="schedule" className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                  참가 일정
                </label>
                {loadingSessions ? (
                  <p className="font-body text-sm text-ink-2">로딩 중...</p>
                ) : (
                  <select
                    id="schedule"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full input-v12 appearance-none bg-no-repeat bg-right pr-10"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23EE5D0C\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")' }}
                  >
                    <option value="">-- 일정 선택 --</option>
                    {sessions.map((session) => {
                      const start = session.session_time?.slice(0, 5) || '';
                      const timeStr = start ? (() => {
                        const [h, m] = start.split(':').map(Number);
                        const endMin = h * 60 + m + 150;
                        return `${start}-${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
                      })() : session.session_time || '';
                      return (
                        <option key={session.session_id} value={session.session_id}>
                          {session.game_name} | {session.session_date} {timeStr} | 잔여: {session.available_slots}석
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* 크레딧 사용 + 잔여 크레딧 확인하기 */}
              <div>
                <label htmlFor="credit" className="block font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                  크레딧 사용
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    id="credit"
                    type="text"
                    placeholder="0"
                    value={creditUsed}
                    onChange={(e) => setCreditUsed(e.target.value.replace(/\D/g, ''))}
                    className="w-32 input-v12"
                  />
                  <span className="text-ink-2">/</span>
                  <button
                    type="button"
                    onClick={handleCheckCredits}
                    disabled={loading}
                    className="font-mono text-xs text-signal btn-signal-outline py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    잔여 크레딧 확인하기
                  </button>
                </div>
                <p className="font-body text-sm text-ink-2">
                  현재 크레딧: {userCredits.toLocaleString()}
                </p>
              </div>

              {/* 참가비 — 세션 금액에서 크레딧 사용분 뺀 금액 */}
              <div>
                <p className="font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                  참가비
                </p>
                {selectedSession ? (
                  (() => {
                    const session = sessions.find(s => s.session_id === selectedSession);
                    const basePrice = session?.base_price || 25000;
                    const credits = Number(creditUsed) || 0;
                    const finalPrice = Math.max(0, basePrice - credits);
                    return (
                      <p className="font-display text-lg text-ink">
                        {basePrice.toLocaleString()} - {credits.toLocaleString()}(크레딧) = {finalPrice.toLocaleString()}원
                      </p>
                    );
                  })()
                ) : (
                  <p className="font-display text-lg text-ink-2">일정을 먼저 선택해주세요</p>
                )}
              </div>

              {/* 환불 규정 동의(필수) */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={refundConsent}
                    onChange={(e) => setRefundConsent(e.target.checked)}
                    className="w-4 h-4 accent-signal border border-signal clip-chamfer" 
                  />
                  <span className="font-body text-sm text-ink">
                    환불 규정 동의(필수)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setTermsModal('refund')}
                  className="font-body text-xs text-signal border border-signal clip-chamfer py-1.5 px-3 hover:bg-signal hover:text-white transition-colors"
                >
                  약관확인
                </button>
              </div>

              {/* 입금 안내 */}
              <div className="panel-v12 p-4 md:p-5">
                <p className="font-body text-xs text-ink-2 uppercase tracking-widest mb-2">
                  입금 안내
                </p>
                <p className="text-ink text-sm leading-relaxed">
                  <span className="font-bold">환불 규정 약관을 꼭 확인해주세요.</span>
                  <br />
                  참가비는 아래 계좌로 입금해주세요.
                  <br />
                  참가 신청 하시면 문자로 입금 계좌를 발송해드립니다.
                  <br />
                  참가 신청 이후에 12시간 내에 입금이 확인되지 않을 경우, 자동으로 신청이 취소됩니다.
                  <hr className="my-3 border-t border-signal/30 w-full" />
                  <span className="font-bold">카카오뱅크 3333-16-760925 예금주: 김석원</span>
                </p>
              </div>
              
              {error && (
                <p className="font-body text-sm text-red-500">{error}</p>
              )}
            </div>

            {/* 참가 신청 완료 — 클릭 시 완료 화면으로 */}
            <button
              type="button"
              onClick={handleApplyComplete}
              disabled={loading}
              className="mt-10 btn-signal text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="eyebrow-v12 mb-6">
              DO:LAB · NEON PROJECT
            </p>
            <Image
              src="/brand/dio.png"
              alt=""
              width={64}
              height={64}
              className="mx-auto mb-6 w-16 h-16 object-contain"
            />
            <h2 className="font-display text-3xl font-black text-ink tracking-tight mb-4">
              신청이 완료되었습니다.
            </h2>
            <p className="font-body text-xl text-ink font-medium">
              환영합니다, 테스터 님.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
