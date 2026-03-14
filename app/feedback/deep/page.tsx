'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDER_CLASS =
  'w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF4F00] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,79,0,0.5)]';

const Q1_OPTIONS = [
  { value: 'instagram', label: '인스타그램' },
  { value: 'blog', label: '블로그' },
  { value: 'friend', label: '지인 추천' },
  { value: 'other', label: '기타' },
] as const;

const Q4Q5_OPTIONS = [
  { value: 'rules', label: '룰' },
  { value: 'concept', label: '콘셉' },
  { value: 'difficulty', label: '난이도' },
  { value: 'atmosphere', label: '분위기' },
  { value: 'group_size', label: '인원 구성' },
  { value: 'game_flow', label: '게임 진행' },
  { value: 'other', label: '기타' },
] as const;

const Q3_LABELS = ['너무 쉬움', '쉬움', '적당함', '어려움', '너무 어려움'];

type Step = 'info' | 'feedback' | 'done';

function DeepFeedbackContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') ?? '';
  const gameName = searchParams.get('gameName') ?? '';

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Q1: 알게 된 경로
  const [q1, setQ1] = useState<string>('');
  const [q1Other, setQ1Other] = useState('');
  // Q2: 비슷한 콘텐츠 즐김 (0-5)
  const [q2, setQ2] = useState(2);
  // Q3: 난이도 (0-4, 5단계)
  const [q3, setQ3] = useState(2);
  // Q4: 좋았던 부분 (다중선택)
  const [q4, setQ4] = useState<string[]>([]);
  const [q4Other, setQ4Other] = useState('');
  // Q5: 아쉬웠던 부분 (다중선택)
  const [q5, setQ5] = useState<string[]>([]);
  const [q5Other, setQ5Other] = useState('');
  // Q6: 재플레이 의향 (0-5)
  const [q6, setQ6] = useState(3);
  // Q7: 종합 점수 (0-5)
  const [q7, setQ7] = useState(3);
  // Q8: 이유 (주관식)
  const [q8, setQ8] = useState('');
  // Q9: 자유 피드백 (선택)
  const [q9, setQ9] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [creditsGranted, setCreditsGranted] = useState(true);

  const canProceedInfo = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 10;

  const toggleMulti = (arr: string[], val: string) => {
    if (arr.includes(val)) return arr.filter((x) => x !== val);
    return [...arr, val];
  };

  const handleProceedToFeedback = () => {
    setError('');
    if (canProceedInfo) setStep('feedback');
  };

  const buildFeedbackData = () => ({
    q1_discovery: q1 || null,
    q1_other_text: q1 === 'other' ? q1Other.trim() || null : null,
    q2_similar_content: q2,
    q3_difficulty: q3,
    q4_liked: q4,
    q4_other_text: q4.includes('other') ? q4Other.trim() || null : null,
    q5_disappointing: q5,
    q5_other_text: q5.includes('other') ? q5Other.trim() || null : null,
    q6_replay_intent: q6,
    q7_overall_score: q7,
    q8_reason: q8.trim() || null,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/feedback/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          session_id: sessionId || undefined,
          game_name: gameName || undefined,
          feedback_data: buildFeedbackData(),
          free_text: q9.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreditsGranted(data.credits_granted !== false);
        setStep('done');
      } else {
        setError(data.error || '제출에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      setError('제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const QuestionBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-10">
      <div className="text-xl font-extrabold mb-4 border-l-4 border-[#FF4F00] pl-4">{title}</div>
      <div className="bg-white p-6 border border-gray-200">{children}</div>
    </div>
  );

  const SharedLayout = (
    <main className="min-h-screen w-screen overflow-hidden bg-[#F2F4F6] relative font-body">
      <div
        className="fixed inset-0 pointer-events-none z-[9998] opacity-100"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
          `,
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

      <div className="relative z-10 flex flex-col items-center min-h-screen py-12 px-6">
        <div className="w-full max-w-[800px]">
          <AnimatePresence mode="wait">
            {/* Step 1: 이름 + 전화번호 */}
            {step === 'info' && (
              <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="text-3xl font-extrabold mb-2 border-l-4 border-[#FF4F00] pl-4">심층 피드백</h1>
                <p className="text-[#666] mb-12 pl-4">
                  피드백 제출 시 2,000 크레딧이 지급됩니다. 가입 시 사용한 이름과 전화번호를 입력해주세요.
                </p>
                <div className="mb-8">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">이름</div>
                  <div className="bg-white p-8 border border-gray-200">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="가입 시 등록한 이름"
                      className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    />
                  </div>
                </div>
                <div className="mb-12">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">전화번호</div>
                  <div className="bg-white p-8 border border-gray-200">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleProceedToFeedback}
                  disabled={!canProceedInfo}
                  className={`w-full py-6 text-3xl font-extrabold border-none transition-colors ${
                    canProceedInfo ? 'bg-[#FF4F00] text-white cursor-pointer hover:bg-[#e64700]' : 'bg-gray-300 text-white cursor-not-allowed'
                  }`}
                >
                  다음
                </button>
              </motion.div>
            )}

            {/* Step 2: 피드백 문항 1-9 */}
            {step === 'feedback' && (
              <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="text-3xl font-extrabold mb-2 border-l-4 border-[#FF4F00] pl-4">심층 피드백</h1>
                <p className="text-[#666] mb-8 pl-4">DO:LAB NEON PROJECT에 대한 자세한 의견을 남겨주세요.</p>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
                )}

                {/* Q1 */}
                <QuestionBlock title="1. DO:LAB 소셜 전략 게임을 처음 알게 된 경로는 무엇인가요?">
                  <div className="flex flex-wrap gap-3">
                    {Q1_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="q1"
                          checked={q1 === opt.value}
                          onChange={() => setQ1(opt.value)}
                          className="w-5 h-5 accent-[#FF4F00]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {q1 === 'other' && (
                    <input
                      type="text"
                      value={q1Other}
                      onChange={(e) => setQ1Other(e.target.value)}
                      placeholder="직접 입력"
                      className="mt-3 w-full border border-gray-200 rounded p-3 text-[#222] focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    />
                  )}
                </QuestionBlock>

                {/* Q2 */}
                <QuestionBlock title="2. 평소 방탈출, 마피아, 크라인씬카페, 보드게임 등 오프라인에서 비슷한 콘텐츠를 자주 즐기시나요?">
                  <input type="range" min={0} max={5} value={q2} onChange={(e) => setQ2(Number(e.target.value))} className={SLIDER_CLASS} />
                  <div className="flex justify-between font-semibold text-[#666] mt-1">
                    <span>0 (전혀 안 함)</span>
                    <span className="text-[#FF4F00] text-xl font-extrabold">{q2}</span>
                    <span>5 (매우 자주)</span>
                  </div>
                </QuestionBlock>

                {/* Q3 */}
                <QuestionBlock title="3. 오늘 게임의 난이도는 어땠나요?">
                  <input type="range" min={0} max={4} value={q3} onChange={(e) => setQ3(Number(e.target.value))} className={SLIDER_CLASS} />
                  <div className="flex justify-between font-semibold text-[#666] mt-1 text-sm">
                    <span>너무 쉬움</span>
                    <span className="text-[#FF4F00] text-xl font-extrabold">{Q3_LABELS[q3]}</span>
                    <span>너무 어려움</span>
                  </div>
                </QuestionBlock>

                {/* Q4 */}
                <QuestionBlock title="4. 오늘 게임에서 좋았던 부분은 어떤 점인가요? (다중 선택 가능)">
                  <div className="flex flex-wrap gap-3">
                    {Q4Q5_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q4.includes(opt.value)}
                          onChange={() => setQ4(toggleMulti(q4, opt.value))}
                          className="w-5 h-5 accent-[#FF4F00]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {q4.includes('other') && (
                    <input
                      type="text"
                      value={q4Other}
                      onChange={(e) => setQ4Other(e.target.value)}
                      placeholder="직접 입력"
                      className="mt-3 w-full border border-gray-200 rounded p-3 text-[#222] focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    />
                  )}
                </QuestionBlock>

                {/* Q5 */}
                <QuestionBlock title="5. 오늘 게임에서 아쉬웠던 부분은 어떤 점인가요? (다중 선택 가능)">
                  <div className="flex flex-wrap gap-3">
                    {Q4Q5_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q5.includes(opt.value)}
                          onChange={() => setQ5(toggleMulti(q5, opt.value))}
                          className="w-5 h-5 accent-[#FF4F00]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {q5.includes('other') && (
                    <input
                      type="text"
                      value={q5Other}
                      onChange={(e) => setQ5Other(e.target.value)}
                      placeholder="직접 입력"
                      className="mt-3 w-full border border-gray-200 rounded p-3 text-[#222] focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    />
                  )}
                </QuestionBlock>

                {/* Q6 */}
                <QuestionBlock title="6. 오늘 플레이한 게임을 다시 플레이 할 의향이 있으신가요?">
                  <input type="range" min={0} max={5} value={q6} onChange={(e) => setQ6(Number(e.target.value))} className={SLIDER_CLASS} />
                  <div className="flex justify-between font-semibold text-[#666] mt-1">
                    <span>0 (없음)</span>
                    <span className="text-[#FF4F00] text-xl font-extrabold">{q6}</span>
                    <span>5 (매우 있음)</span>
                  </div>
                </QuestionBlock>

                {/* Q7 */}
                <QuestionBlock title="7. 오늘 종합적인 콘텐츠 체험의 점수는 몇 점인가요?">
                  <input type="range" min={0} max={5} value={q7} onChange={(e) => setQ7(Number(e.target.value))} className={SLIDER_CLASS} />
                  <div className="flex justify-between font-semibold text-[#666] mt-1">
                    <span>0점</span>
                    <span className="text-[#FF4F00] text-xl font-extrabold">{q7}점</span>
                    <span>5점</span>
                  </div>
                </QuestionBlock>

                {/* Q8 */}
                <QuestionBlock title="8. 이유는 무엇인가요?">
                  <textarea
                    value={q8}
                    onChange={(e) => setQ8(e.target.value)}
                    placeholder="점수에 대한 이유를 적어주세요."
                    rows={3}
                    className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    maxLength={1000}
                  />
                  <p className="text-sm text-[#666] mt-1">{q8.length}/1000</p>
                </QuestionBlock>

                {/* Q9 */}
                <QuestionBlock title="9. 그 외 자유로운 피드백 (선택)">
                  <textarea
                    value={q9}
                    onChange={(e) => setQ9(e.target.value)}
                    placeholder="참고하여 더 좋은 콘텐츠를 제공해드릴 수 있도록 노력하겠습니다."
                    rows={4}
                    className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                    maxLength={2000}
                  />
                  <p className="text-sm text-[#666] mt-1">{q9.length}/2000</p>
                </QuestionBlock>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setStep('info')}
                    className="flex-1 py-5 text-xl font-extrabold border-2 border-[#FF4F00] text-[#FF4F00] bg-white cursor-pointer hover:bg-[#FFF5F0]"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-5 text-xl font-extrabold border-none bg-[#FF4F00] text-white cursor-pointer hover:bg-[#e64700] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? '제출 중...' : '제출하기'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: 완료 */}
            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white p-12 border-4 border-[#FF4F00] text-center"
              >
                <p className="text-2xl font-bold text-[#222] mb-4">감사합니다!</p>
                <p className="text-[#666] mb-2">소중한 피드백이 전달되었습니다.</p>
                {creditsGranted ? (
                  <p className="text-[#FF4F00] font-semibold">2,000 크레딧이 지급되었습니다.</p>
                ) : (
                  <p className="text-[#666] text-sm">등록된 회원이 아니어서 크레딧은 지급되지 않았습니다.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );

  return SharedLayout;
}

export default function DeepFeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F2F4F6]">로딩 중...</div>}>
      <DeepFeedbackContent />
    </Suspense>
  );
}
