'use client';

import { useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDER_CLASS =
  'w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF4F00] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,79,0,0.5)]';

const DISCOVERY_OPTIONS = [
  { value: 'sns', label: 'SNS (인스타·유튜브 등)' },
  { value: 'friend', label: '지인 추천' },
  { value: 'search', label: '검색' },
  { value: 'other', label: '기타' },
] as const;

const PRICE_OPTIONS = [
  { value: 'under10k', label: '1만원 이하' },
  { value: '10k-20k', label: '1–2만원' },
  { value: '20k-30k', label: '2–3만원' },
  { value: 'over30k', label: '3만원 이상' },
] as const;

const FRIEND_OPTIONS = [
  { value: 'yes', label: '예' },
  { value: 'maybe', label: '아마도' },
  { value: 'no', label: '아니오' },
] as const;

const STRANGER_LABELS = ['매우 불편했음', '불편했음', '보통', '좋았음', '매우 좋았음'];
const FUN_LABELS = ['매우 재미없음', '재미없음', '보통', '재미있음', '매우 재미있음'];
const DIFF_LABELS = ['너무 쉬움', '쉬움', '적당함', '어려움', '너무 어려움'];

type Step = 'expired' | 'identity' | 'feedback' | 'done';

const HUD = () => (
  <>
    <div
      className="fixed inset-0 pointer-events-none z-[9998]"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }}
    />
    <div
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{
        background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.03) 50%)',
        backgroundSize: '100% 4px',
      }}
    />
    <div className="fixed top-5 left-5 right-5 bottom-5 pointer-events-none z-[9997] border border-black/10">
      <div className="absolute top-0 left-0 w-8 h-8 border-[3px] border-[#FF4F00] border-r-0 border-b-0" />
      <div className="absolute top-0 right-0 w-8 h-8 border-[3px] border-[#FF4F00] border-l-0 border-b-0" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-[3px] border-[#FF4F00] border-r-0 border-t-0" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-[3px] border-[#FF4F00] border-l-0 border-t-0" />
      <div className="absolute top-3 right-12 flex items-center gap-2 text-sm text-[#222] opacity-60">
        ONLINE <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#00ff00]" />
      </div>
    </div>
  </>
);

const QuestionBlock = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <div className="text-lg font-extrabold mb-1 border-l-4 border-[#FF4F00] pl-4">{title}</div>
    {subtitle && <p className="text-sm text-[#888] pl-4 mb-3">{subtitle}</p>}
    <div className="bg-white p-6 border border-gray-200">{children}</div>
  </div>
);

function DeepFeedbackContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') ?? searchParams.get('sessionId') ?? '';
  const gameName = searchParams.get('gameName') ?? '';
  const expiresParam = searchParams.get('expires');

  // 만료 체크
  const isExpired = useMemo(() => {
    if (!expiresParam) return false;
    const expiresTs = parseInt(expiresParam, 10);
    if (isNaN(expiresTs)) return false;
    return Date.now() / 1000 > expiresTs;
  }, [expiresParam]);

  const [step, setStep] = useState<Step>(isExpired ? 'expired' : 'identity');

  // 신원 (선택)
  const [identifier, setIdentifier] = useState('');

  // 문항 — null = 미선택
  const [qFun, setQFun] = useState<number | null>(null);     // a. 게임 재미 (필수)
  const [qDiff, setQDiff] = useState<number | null>(null);   // b. 난이도 (필수)
  const [qMoment, setQMoment] = useState('');                // c. 기억에 남는 순간 (선택)
  const [qRegret, setQRegret] = useState('');                // d. 아쉬웠던 점 (선택)
  const [qStranger, setQStranger] = useState<number | null>(null); // e. 낯선 사람 경험 (필수)
  const [qDiscovery, setQDiscovery] = useState('');          // f. 알게 된 경로 (필수)
  const [qDiscoveryOther, setQDiscoveryOther] = useState('');
  const [qPrice, setQPrice] = useState('');                  // g. 적정 가격 (선택)
  const [qFriend, setQFriend] = useState('');                // h. 친구 데려올 의향 (선택)

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [creditsGranted, setCreditsGranted] = useState(false);

  const canSubmit = qFun !== null && qDiff !== null && qStranger !== null && qDiscovery !== '';

  const buildFeedbackData = () => ({
    fun_score: qFun !== null ? qFun + 1 : null,
    difficulty: qDiff !== null ? qDiff + 1 : null,
    memorable_moment: qMoment.trim() || null,
    regret: qRegret.trim() || null,
    stranger_experience: qStranger !== null ? qStranger + 1 : null,
    discovery: qDiscovery || null,
    discovery_other: qDiscovery === 'other' ? qDiscoveryOther.trim() || null : null,
    price_preference: qPrice || null,
    friend_intent: qFriend || null,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/feedback/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim() || undefined,
          session_id: sessionId || undefined,
          game_name: gameName || undefined,
          feedback_data: buildFeedbackData(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreditsGranted(data.credits_granted === true);
        setStep('done');
      } else if (res.status === 409) {
        setError(data.error);
      } else {
        setError(data.error || '제출에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      setError('제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-[#F2F4F6] relative font-body">
      <HUD />
      <div className="relative z-10 flex flex-col items-center min-h-screen py-12 px-6">
        <div className="w-full max-w-[700px]">
          <AnimatePresence mode="wait">

            {/* 만료 */}
            {step === 'expired' && (
              <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border-4 border-gray-300 p-12 text-center mt-20">
                  <p className="text-2xl font-bold text-[#444] mb-3">오늘 세션이 종료되었습니다</p>
                  <p className="text-[#888] text-sm">이 QR 코드는 오늘 자정에 만료되었습니다.</p>
                </div>
              </motion.div>
            )}

            {/* 신원 입력 (선택) */}
            {step === 'identity' && (
              <motion.div key="identity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="text-3xl font-extrabold mb-2 border-l-4 border-[#FF4F00] pl-4">심층 피드백</h1>
                <p className="text-[#666] mb-2 pl-4">
                  작성하시면 <span className="text-[#FF4F00] font-bold">1,500 크레딧</span>이 지급됩니다.
                </p>
                <p className="text-[#999] text-sm mb-8 pl-4">총 소요시간 약 2–3분</p>

                <div className="bg-white border border-gray-200 p-6 mb-6">
                  <p className="font-bold text-[#222] mb-1">닉네임 또는 전화번호 뒷 4자리</p>
                  <p className="text-sm text-[#999] mb-4">크레딧을 받으려면 입력하세요. 익명으로도 제출 가능합니다.</p>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="예: 홍길동 또는 1234"
                    className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    maxLength={20}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setIdentifier(''); setStep('feedback'); }}
                    className="flex-1 py-4 text-base font-semibold border border-gray-300 text-[#888] bg-white cursor-pointer hover:bg-gray-50"
                  >
                    익명으로 제출
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('feedback')}
                    className="flex-[2] py-4 text-xl font-extrabold bg-[#FF4F00] text-white border-none cursor-pointer hover:bg-[#e64700]"
                  >
                    다음
                  </button>
                </div>
              </motion.div>
            )}

            {/* 피드백 문항 */}
            {step === 'feedback' && (
              <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="text-3xl font-extrabold mb-2 border-l-4 border-[#FF4F00] pl-4">심층 피드백</h1>
                <p className="text-[#666] mb-8 pl-4">DO:LAB 소셜 전략 게임에 대한 솔직한 의견을 남겨주세요.</p>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
                )}

                {/* a. 게임 재미 */}
                <QuestionBlock title="1. 오늘 게임은 얼마나 재미있었나요? *">
                  {qFun === null ? (
                    <div className="flex gap-2 flex-wrap">
                      {FUN_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => setQFun(i)}
                          className="flex-1 min-w-[80px] py-2 text-sm font-semibold border border-gray-300 bg-white text-[#444] cursor-pointer hover:border-[#FF4F00] hover:text-[#FF4F00]">
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input type="range" min={0} max={4} value={qFun} onChange={(e) => setQFun(Number(e.target.value))} className={SLIDER_CLASS} />
                      <div className="flex justify-between text-sm text-[#666] mt-2">
                        <span>매우 재미없음</span>
                        <span className="text-[#FF4F00] text-xl font-extrabold">{FUN_LABELS[qFun]}</span>
                        <span>매우 재미있음</span>
                      </div>
                    </>
                  )}
                </QuestionBlock>

                {/* b. 난이도 */}
                <QuestionBlock title="2. 오늘 게임의 난이도는 어땠나요? *">
                  {qDiff === null ? (
                    <div className="flex gap-2 flex-wrap">
                      {DIFF_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => setQDiff(i)}
                          className="flex-1 min-w-[80px] py-2 text-sm font-semibold border border-gray-300 bg-white text-[#444] cursor-pointer hover:border-[#FF4F00] hover:text-[#FF4F00]">
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input type="range" min={0} max={4} value={qDiff} onChange={(e) => setQDiff(Number(e.target.value))} className={SLIDER_CLASS} />
                      <div className="flex justify-between text-sm text-[#666] mt-2">
                        <span>너무 쉬움</span>
                        <span className="text-[#FF4F00] text-xl font-extrabold">{DIFF_LABELS[qDiff]}</span>
                        <span>너무 어려움</span>
                      </div>
                    </>
                  )}
                </QuestionBlock>

                {/* c. 기억에 남는 순간 */}
                <QuestionBlock title="3. 가장 기억에 남는 순간은? (선택)">
                  <textarea
                    value={qMoment}
                    onChange={(e) => setQMoment(e.target.value)}
                    placeholder="인상 깊었던 장면이나 전략을 적어주세요."
                    rows={3}
                    className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    maxLength={500}
                  />
                  <p className="text-xs text-[#999] mt-1 text-right">{qMoment.length}/500</p>
                </QuestionBlock>

                {/* d. 아쉬웠던 점 */}
                <QuestionBlock title="4. 아쉬웠던 점이 있다면? (선택)">
                  <textarea
                    value={qRegret}
                    onChange={(e) => setQRegret(e.target.value)}
                    placeholder="게임 규칙, 진행 방식, 분위기 등 자유롭게 적어주세요."
                    rows={3}
                    className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    maxLength={500}
                  />
                  <p className="text-xs text-[#999] mt-1 text-right">{qRegret.length}/500</p>
                </QuestionBlock>

                {/* e. 낯선 사람 경험 */}
                <QuestionBlock title="5. 낯선 사람들과 함께한 경험은 어땠나요? *">
                  {qStranger === null ? (
                    <div className="flex gap-2 flex-wrap">
                      {STRANGER_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => setQStranger(i)}
                          className="flex-1 min-w-[80px] py-2 text-sm font-semibold border border-gray-300 bg-white text-[#444] cursor-pointer hover:border-[#FF4F00] hover:text-[#FF4F00]">
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input type="range" min={0} max={4} value={qStranger} onChange={(e) => setQStranger(Number(e.target.value))} className={SLIDER_CLASS} />
                      <div className="flex justify-between text-sm text-[#666] mt-2">
                        <span>매우 불편</span>
                        <span className="text-[#FF4F00] text-xl font-extrabold">{STRANGER_LABELS[qStranger]}</span>
                        <span>매우 좋았음</span>
                      </div>
                    </>
                  )}
                </QuestionBlock>

                {/* f. 알게 된 경로 */}
                <QuestionBlock title="6. DO:LAB을 어떻게 알게 되셨나요? *">
                  <div className="flex flex-wrap gap-3">
                    {DISCOVERY_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="discovery"
                          checked={qDiscovery === opt.value}
                          onChange={() => setQDiscovery(opt.value)}
                          className="w-5 h-5 accent-[#FF4F00]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {qDiscovery === 'other' && (
                    <input
                      type="text"
                      value={qDiscoveryOther}
                      onChange={(e) => setQDiscoveryOther(e.target.value)}
                      placeholder="직접 입력"
                      className="mt-3 w-full border border-gray-200 rounded p-3 text-[#222] focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    />
                  )}
                </QuestionBlock>

                {/* g. 적정 가격 */}
                <QuestionBlock title="7. 이 게임의 적정 참가비는 얼마라고 생각하시나요?">
                  <div className="flex flex-wrap gap-3">
                    {PRICE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="price"
                          checked={qPrice === opt.value}
                          onChange={() => setQPrice(opt.value)}
                          className="w-5 h-5 accent-[#FF4F00]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </QuestionBlock>

                {/* h. 친구 데려올 의향 */}
                <QuestionBlock title="8. 친구를 데려올 의향이 있나요?">
                  <div className="flex gap-3">
                    {FRIEND_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setQFriend(opt.value)}
                        className={`flex-1 py-3 text-base font-bold border-2 transition-all cursor-pointer ${
                          qFriend === opt.value
                            ? 'bg-[#FF4F00] text-white border-[#FF4F00]'
                            : 'bg-white text-[#444] border-gray-300 hover:border-[#FF4F00] hover:text-[#FF4F00]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </QuestionBlock>

                {/* i. 후기 링크 (선택, +500 크레딧 안내) */}
                <div className="bg-[#FFF8F5] border border-[#FFCCB3] p-5 mb-8 rounded">
                  <p className="font-bold text-[#FF4F00] mb-2 text-sm">선택 — 후기를 남기면 +500 크레딧 추가 지급!</p>
                  <p className="text-[#555] text-sm mb-3">아래 링크에서 네이버 또는 카카오 후기를 작성하고 스태프에게 보여주세요.</p>
                  <div className="flex gap-3 flex-wrap">
                    <a
                      href="https://map.naver.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#03C75A] text-white text-sm font-bold rounded hover:opacity-90"
                    >
                      네이버 후기 남기기
                    </a>
                    <a
                      href="https://map.kakao.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#FEE500] text-[#3C1E1E] text-sm font-bold rounded hover:opacity-90"
                    >
                      카카오맵 후기 남기기
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep('identity')}
                    className="flex-1 py-5 text-xl font-extrabold border-2 border-[#FF4F00] text-[#FF4F00] bg-white cursor-pointer hover:bg-[#FFF5F0]"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !canSubmit}
                    className="flex-[2] py-5 text-xl font-extrabold bg-[#FF4F00] text-white border-none cursor-pointer hover:bg-[#e64700] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? '제출 중...' : !canSubmit ? '필수 항목을 선택해주세요 (1·2·5·6번)' : '제출하기'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* 완료 */}
            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white p-12 border-4 border-[#FF4F00] text-center mt-8"
              >
                <p className="text-2xl font-bold text-[#222] mb-4">감사합니다!</p>
                <p className="text-[#666] mb-2">소중한 피드백이 전달되었습니다.</p>
                {creditsGranted ? (
                  <p className="text-[#FF4F00] font-semibold mt-3">1,500 크레딧이 지급되었습니다.</p>
                ) : (
                  <p className="text-[#999] text-sm mt-3">
                    닉네임/전화번호를 입력하지 않으셨거나 일치하는 계정이 없어 크레딧은 지급되지 않았습니다.
                  </p>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

export default function DeepFeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F2F4F6]">로딩 중...</div>}>
      <DeepFeedbackContent />
    </Suspense>
  );
}
