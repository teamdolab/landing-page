'use client';

import { useCallback, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import {
  supabase,
  checkUserExists,
  verifyUserPassword,
  verifyReferrerExists,
  getSessionAvailability,
  getUserCredits,
  type SessionAvailability,
} from '@/lib/supabase';
import { gtagEvent } from '@/lib/analytics';

export const FLOW_STEPS = ['시작', '정보', '인증', '결제', '완료'] as const;

const normalizePhone = (p: string) => p.replace(/\D/g, '');

export function useApplyFlow() {
  const posthog = usePostHog();

  const track = useCallback(
    (name: string, props?: Record<string, unknown>) => {
      gtagEvent(name, props);
      posthog?.capture(name, props);
    },
    [posthog],
  );

  const [flowOpen, setFlowOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [presetSessionId, setPresetSessionId] = useState('');

  const [sessions, setSessions] = useState<SessionAvailability[]>([]);
  const [allSessions, setAllSessions] = useState<SessionAvailability[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [referrer, setReferrer] = useState('');

  const [isExistingUser, setIsExistingUser] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState(0);

  const [selectedSession, setSelectedSession] = useState('');
  const [creditUsed, setCreditUsed] = useState('');
  const [refundConsent, setRefundConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [termsModal, setTermsModal] = useState<'privacy' | 'marketing' | 'refund' | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [showEventModal, setShowEventModal] = useState<'newuser' | 'referrer' | null>(null);

  const resetForm = useCallback(() => {
    setStepIdx(0);
    setPresetSessionId('');
    setName('');
    setPhone('');
    setNickname('');
    setPassword('');
    setPrivacyConsent(false);
    setMarketingConsent(false);
    setReferrer('');
    setIsExistingUser(false);
    setUserId(null);
    setUserCredits(0);
    setSelectedSession('');
    setCreditUsed('');
    setRefundConsent(false);
    setError('');
    setShowSignupConfirm(false);
  }, []);

  const closeFlow = useCallback(() => {
    setFlowOpen(false);
    resetForm();
  }, [resetForm]);

  const loadAllSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await getSessionAvailability();
      setAllSessions(data);
      return data;
    } catch (err) {
      console.error('세션 조회 실패:', err);
      return [];
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadSessionsForSchedule = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await getSessionAvailability();
      const open = data.filter((s) => s.status === '모집중' && s.available_slots > 0);
      setSessions(open);
      return open;
    } catch (err) {
      console.error('세션 조회 실패:', err);
      setError('세션 정보를 불러오는데 실패했습니다.');
      return [];
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const openFlow = useCallback(
    (sessionId?: string) => {
      resetForm();
      if (sessionId) {
        setPresetSessionId(sessionId);
        setSelectedSession(sessionId);
      }
      setFlowOpen(true);
      track('apply_start');
    },
    [resetForm, track],
  );

  const goToScheduleStep = useCallback(async () => {
    await loadSessionsForSchedule();
    if (presetSessionId) setSelectedSession(presetSessionId);
    setStepIdx(3);
    track('payment_view');
  }, [loadSessionsForSchedule, presetSessionId, track]);

  const handleStep1Continue = useCallback(async () => {
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
        setIsExistingUser(true);
        setUserId(result.user_id);
        setNickname(result.nickname || '');
        setUserCredits(result.credits);
      } else {
        setIsExistingUser(false);
        setUserId(null);
        setUserCredits(0);
      }
      setStepIdx(2);
    } catch (err) {
      console.error('유저 확인 실패:', err);
      setError('유저 정보를 확인하는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [name, phone]);

  const handleStep2Continue = useCallback(async () => {
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
        const user = await verifyUserPassword(userId, password);
        if (!user) {
          setError('패스워드가 일치하지 않습니다.');
          return;
        }
        setUserCredits(user.credits);
        posthog?.identify(String(user.id ?? userId));
        await goToScheduleStep();
      } catch (err) {
        console.error('로그인 실패:', err);
        setError('로그인에 실패했습니다.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!nickname.trim() || !password || password.length !== 4) {
      setError('닉네임과 4자리 패스워드를 입력해주세요.');
      return;
    }
    if (!privacyConsent) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

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

    setShowSignupConfirm(true);
  }, [isExistingUser, userId, password, nickname, privacyConsent, referrer, phone, goToScheduleStep, posthog]);

  const handleSignupConfirm = useCallback(async () => {
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

      await goToScheduleStep();
    } catch (err) {
      console.error('가입 중 에러:', err);
      setError('가입 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [name, phone, nickname, password, privacyConsent, marketingConsent, referrer, goToScheduleStep, posthog]);

  const handleApplyComplete = useCallback(async () => {
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

    const selectedSessionData = sessions.find((s) => s.session_id === selectedSession);
    if (!selectedSessionData) {
      setError('선택한 세션 정보를 찾을 수 없습니다.');
      return;
    }

    const finalPrice = Math.max(0, selectedSessionData.base_price - usedCreditsNum);

    setLoading(true);
    setError('');

    try {
      const { error: applyError } = await supabase.from('apply').insert({
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
        const isDuplicate =
          applyError.code === '23505' || applyError.message?.includes('apply_user_id_session_id_key');
        setError(
          isDuplicate
            ? '이미 신청한 게임입니다.'
            : '죄송합니다. 신청에 실패했습니다. 잠시 후 다시 시도해주시거나, DO:LAB 카카오톡 채널로 문의주시기 바랍니다.',
        );
        return;
      }

      setStepIdx(4);
      track('apply_complete', { session_id: selectedSession });
      await loadAllSessions();
    } catch (err) {
      console.error('신청 중 에러:', err);
      setError('죄송합니다. 신청에 실패했습니다. 잠시 후 다시 시도해주시거나, DO:LAB 카카오톡 채널로 문의주시기 바랍니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedSession, refundConsent, userId, creditUsed, userCredits, sessions, track, loadAllSessions]);

  const handleCheckCredits = useCallback(async () => {
    if (!phone) {
      setError('전화번호를 먼저 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const credits = await getUserCredits(normalizePhone(phone));
      setUserCredits(credits);
    } catch (err) {
      console.error('크레딧 조회 실패:', err);
      setError('크레딧 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleFlowBack = useCallback(() => {
    setError('');
    if (stepIdx === 4) {
      closeFlow();
      return;
    }
    if (stepIdx === 3) {
      setStepIdx(2);
      return;
    }
    if (stepIdx === 2) {
      setStepIdx(1);
      return;
    }
    if (stepIdx === 1) {
      setStepIdx(0);
      return;
    }
    closeFlow();
  }, [stepIdx, closeFlow]);

  const openAvailability = useCallback(async () => {
    setShowAvailability(true);
    await loadAllSessions();
  }, [loadAllSessions]);

  const selectedSessionData = sessions.find((s) => s.session_id === selectedSession);
  const creditNum = Math.min(Number(creditUsed) || 0, userCredits);
  const finalFee = selectedSessionData ? Math.max(0, selectedSessionData.base_price - creditNum) : null;

  const canNext =
    stepIdx === 0
      ? true
      : stepIdx === 1
        ? name.trim().length >= 2 && normalizePhone(phone).length >= 10
        : stepIdx === 3
          ? !!selectedSession && refundConsent
          : false;

  return {
    FLOW_STEPS,
    flowOpen,
    stepIdx,
    setStepIdx,
    sessions,
    allSessions,
    loadingSessions,
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
    userId,
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
    openFlow,
    closeFlow,
    loadAllSessions,
    handleStep1Continue,
    handleStep2Continue,
    handleSignupConfirm,
    handleApplyComplete,
    handleCheckCredits,
    handleFlowBack,
    openAvailability,
  };
}
