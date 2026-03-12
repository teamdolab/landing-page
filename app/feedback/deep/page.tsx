'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDER_CLASS =
  'w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF4F00] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,79,0,0.5)]';

type Step = 'info' | 'feedback' | 'done';

function DeepFeedbackContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') ?? '';
  const gameName = searchParams.get('gameName') ?? '';

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // 피드백 문항 (추후 사용자가 수정)
  const [gameplayFun, setGameplayFun] = useState(5);
  const [paceDifficulty, setPaceDifficulty] = useState(5);
  const [staffService, setStaffService] = useState(5);
  const [recommendation, setRecommendation] = useState(5);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [creditsGranted, setCreditsGranted] = useState(true);

  const canProceedInfo = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 10;

  const handleProceedToFeedback = () => {
    setError('');
    if (canProceedInfo) setStep('feedback');
  };

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
          feedback_data: {
            gameplay_fun: gameplayFun,
            pace_difficulty: paceDifficulty,
            staff_service: staffService,
            recommendation,
          },
          free_text: freeText.trim() || undefined,
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

      <div className="relative z-10 flex flex-col items-center min-h-screen py-16 px-6">
        <div className="w-full max-w-[800px]">
          <AnimatePresence mode="wait">
            {/* ========== Step 1: 이름 + 전화번호 ========== */}
            {step === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-3xl font-extrabold mb-2 border-l-4 border-[#FF4F00] pl-4">
                  심층 피드백
                </h1>
                <p className="text-[#666] mb-12 pl-4">
                  피드백 제출 시 2,000 크레딧이 지급됩니다. 가입 시 사용한 이름과 전화번호를 입력해주세요.
                </p>

                <div className="mb-8">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    이름
                  </div>
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
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    전화번호
                  </div>
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

            {/* ========== Step 2: 피드백 문항 (추후 사용자가 수정) ========== */}
            {step === 'feedback' && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-3xl font-extrabold mb-2 border-l-4 border-[#FF4F00] pl-4">
                  심층 피드백
                </h1>
                <p className="text-[#666] mb-12 pl-4">
                  DO:LAB NEON PROJECT에 대한 자세한 의견을 남겨주세요.
                </p>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                    {error}
                  </div>
                )}

                {/* placeholder 문항 - 사용자가 추후 수정 */}
                <div className="mb-12">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    게임의 재미도는 어떠셨나요?
                  </div>
                  <div className="bg-white p-8 border border-gray-200 flex flex-col gap-2">
                    <input type="range" min={0} max={10} value={gameplayFun} onChange={(e) => setGameplayFun(Number(e.target.value))} className={SLIDER_CLASS} />
                    <div className="flex justify-between font-semibold text-[#666] mt-1">
                      <span>0 (재미없음)</span>
                      <span className="text-[#FF4F00] text-2xl font-extrabold">{gameplayFun}</span>
                      <span>10 (매우 재미있음)</span>
                    </div>
                  </div>
                </div>

                <div className="mb-12">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    진행 속도와 난이도는 어떠셨나요?
                  </div>
                  <div className="bg-white p-8 border border-gray-200 flex flex-col gap-2">
                    <input type="range" min={0} max={10} value={paceDifficulty} onChange={(e) => setPaceDifficulty(Number(e.target.value))} className={SLIDER_CLASS} />
                    <div className="flex justify-between font-semibold text-[#666] mt-1">
                      <span>0 (너무 느림/쉬움)</span>
                      <span className="text-[#FF4F00] text-2xl font-extrabold">{paceDifficulty}</span>
                      <span>10 (적당함)</span>
                    </div>
                  </div>
                </div>

                <div className="mb-12">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    직원/서비스 만족도는 어떠셨나요?
                  </div>
                  <div className="bg-white p-8 border border-gray-200 flex flex-col gap-2">
                    <input type="range" min={0} max={10} value={staffService} onChange={(e) => setStaffService(Number(e.target.value))} className={SLIDER_CLASS} />
                    <div className="flex justify-between font-semibold text-[#666] mt-1">
                      <span>0 (불만족)</span>
                      <span className="text-[#FF4F00] text-2xl font-extrabold">{staffService}</span>
                      <span>10 (매우 만족)</span>
                    </div>
                  </div>
                </div>

                <div className="mb-12">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    지인들에게 DO:LAB NEON PROJECT를 추천하시겠습니까?
                  </div>
                  <div className="bg-white p-8 border border-gray-200 flex flex-col gap-2">
                    <input type="range" min={0} max={10} value={recommendation} onChange={(e) => setRecommendation(Number(e.target.value))} className={SLIDER_CLASS} />
                    <div className="flex justify-between font-semibold text-[#666] mt-1">
                      <span>0 (비추천)</span>
                      <span className="text-[#FF4F00] text-2xl font-extrabold">{recommendation}</span>
                      <span>10 (강력 추천)</span>
                    </div>
                  </div>
                </div>

                <div className="mb-12">
                  <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                    추가로 개선되었으면 좋겠다면 (선택)
                  </div>
                  <div className="bg-white p-8 border border-gray-200">
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="자유롭게 의견을 남겨주세요."
                      rows={4}
                      className="w-full border border-gray-200 rounded p-4 text-[#222] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F00]"
                      maxLength={2000}
                    />
                    <p className="text-sm text-[#666] mt-2">{freeText.length}/2000</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep('info')}
                    className="flex-1 py-6 text-2xl font-extrabold border-2 border-[#FF4F00] text-[#FF4F00] bg-white cursor-pointer hover:bg-[#FFF5F0]"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-6 text-2xl font-extrabold border-none bg-[#FF4F00] text-white cursor-pointer hover:bg-[#e64700] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? '제출 중...' : '제출하기'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========== Step 3: 완료 ========== */}
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
