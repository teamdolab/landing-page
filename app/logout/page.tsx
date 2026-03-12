'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import './logout-styles.css';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type Screen = 'nfc' | 'terminal' | 'result' | 'feedback' | 'final';

type LogoutData = {
  nickname: string;
  gameName: string;
  playerNumber: number;
  rank: number;
  totalScore: number;
  creditsBefore: number;
  creditsAfter: number;
  creditGain: number;
};

function LogoutContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId') ?? '';

  const [screen, setScreen] = useState<Screen>('nfc');
  const [nfcError, setNfcError] = useState('');
  const [logoutData, setLogoutData] = useState<LogoutData | null>(null);
  const [q2Score, setQ2Score] = useState(5);
  const [q3Score, setQ3Score] = useState(5);
  const [q2Touched, setQ2Touched] = useState(false);
  const [q3Touched, setQ3Touched] = useState(false);
  const [showTouchText, setShowTouchText] = useState(false);
  const [lineDrawn, setLineDrawn] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [lastNfcId, setLastNfcId] = useState('');
  const nfcInputRef = useRef<HTMLInputElement>(null);

  const showScreen = useCallback((id: Screen) => setScreen(id), []);

  useEffect(() => {
    if (screen === 'nfc') {
      setNfcError('');
      nfcInputRef.current?.setAttribute('data-nfc-buffer', '');
      const t = setTimeout(() => nfcInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [screen]);

  const processNFC = useCallback(
    async (nfcIdRaw: string) => {
      const nfcId = nfcIdRaw?.trim();
      if (!nfcId) return;

      if (!gameId) {
        setNfcError('게임 정보가 없습니다. 컨트롤 페이지에서 로그아웃 화면을 열어주세요.');
        return;
      }

      setNfcError('');
      try {
        const res = await fetch(`/api/game/${encodeURIComponent(gameId)}/logout-lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nfc_id: nfcId }),
        });
        const data = await res.json();

        if (res.ok) {
          setLogoutData(data);
          setLastNfcId(nfcId);
          showScreen('terminal');
        } else {
          setNfcError(data.error || '등록된 플레이어 카드가 아닙니다.');
        }
      } catch {
        setNfcError('조회 중 오류가 발생했습니다.');
      }
    },
    [gameId, showScreen]
  );

  const onTerminalComplete = useCallback(() => {
    showScreen('result');
  }, [showScreen]);

  useEffect(() => {
    if (screen === 'result') {
      const t1 = setTimeout(() => setLineDrawn(true), 200);
      const t2 = setTimeout(() => setTableOpen(true), 1200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setLineDrawn(false);
      setTableOpen(false);
    }
  }, [screen]);

  const goToFeedback = useCallback(() => {
    showScreen('feedback');
  }, [showScreen]);

  const finishFeedback = useCallback(async () => {
    if (gameId && lastNfcId) {
      try {
        await fetch(`/api/game/${encodeURIComponent(gameId)}/logout-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nfc_id: lastNfcId,
            q2_score: q2Score,
            q3_score: q3Score,
          }),
        });
      } catch {
        // 무시
      }
    }
    setShowTouchText(false);
    showScreen('final');
  }, [gameId, lastNfcId, q2Score, q3Score, showScreen]);

  const resetToStart = useCallback(() => {
    setLogoutData(null);
    setLastNfcId('');
    setQ2Score(5);
    setQ3Score(5);
    setQ2Touched(false);
    setQ3Touched(false);
    setShowTouchText(false);
    setLineDrawn(false);
    setTableOpen(false);
    showScreen('nfc');
  }, [showScreen]);

  const canSubmitFeedback = q2Touched && q3Touched;

  const keyCodeToHexChar = (e: React.KeyboardEvent): string | null => {
    const code = e.code;
    if (code?.startsWith('Digit')) return code.slice(-1);
    const map: Record<string, string> = { KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e', KeyF: 'f' };
    return map[code ?? ''] ?? null;
  };

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-[#F2F4F6] relative font-body">
      {/* Grid Background */}
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
      {/* Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.03) 50%)',
          backgroundSize: '100% 4px',
        }}
      />
      {/* HUD Overlay */}
      <div className="fixed top-5 left-5 right-5 bottom-5 pointer-events-none z-[9997] border border-black/10">
        <div className="absolute top-0 left-0 w-8 h-8 border-[3px] border-[#FF4F00] border-r-0 border-b-0" />
        <div className="absolute top-0 right-0 w-8 h-8 border-[3px] border-[#FF4F00] border-l-0 border-b-0" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-[3px] border-[#FF4F00] border-r-0 border-t-0" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-[3px] border-[#FF4F00] border-l-0 border-t-0" />
        <div className="absolute top-3 right-12 flex items-center gap-2 text-sm text-[#222] opacity-60">
          ONLINE <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#00ff00]" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ========== NFC ========== */}
        {screen === 'nfc' && (
          <motion.div
            key="nfc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col justify-center items-center z-10 cursor-pointer"
            onClick={() => nfcInputRef.current?.focus()}
          >
            <input
              ref={nfcInputRef}
              type="text"
              autoComplete="off"
              autoFocus
              lang="en"
              inputMode="text"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-12 opacity-0"
              aria-label="NFC 카드 ID 입력"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (nfcInputRef.current?.getAttribute('data-nfc-buffer') ?? (e.target as HTMLInputElement).value)?.trim();
                  if (val) {
                    processNFC(val);
                    nfcInputRef.current?.setAttribute('data-nfc-buffer', '');
                    (e.target as HTMLInputElement).value = '';
                  }
                } else if (e.key === 'Backspace') {
                  const buf = (nfcInputRef.current?.getAttribute('data-nfc-buffer') ?? '').slice(0, -1);
                  nfcInputRef.current?.setAttribute('data-nfc-buffer', buf);
                  (e.target as HTMLInputElement).value = buf;
                  e.preventDefault();
                } else {
                  const char = keyCodeToHexChar(e);
                  if (char !== null) {
                    e.preventDefault();
                    const buf = (nfcInputRef.current?.getAttribute('data-nfc-buffer') ?? '') + char;
                    nfcInputRef.current?.setAttribute('data-nfc-buffer', buf);
                    (e.target as HTMLInputElement).value = buf;
                  }
                }
              }}
            />
            <div className="relative flex flex-col items-center justify-center flex-1 w-full">
              <div className="relative flex justify-center items-center">
                <div
                  className="absolute w-[120px] h-[120px] rounded-full border-2 border-[#FF4F00] opacity-0 animate-login-pulse-wave"
                  style={{ animationDelay: '0s' }}
                />
                <div
                  className="absolute w-[120px] h-[120px] rounded-full border-2 border-[#FF4F00] opacity-0 animate-login-pulse-wave"
                  style={{ animationDelay: '0.5s' }}
                />
                <svg
                  className="w-[120px] h-[120px] text-[#FF4F00] rotate-90 z-10"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.7 2.06 7.3 2.06 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                </svg>
              </div>
            </div>
            {nfcError && (
              <p className="absolute bottom-[28%] left-1/2 -translate-x-1/2 text-sm text-[#FF4F00] text-center max-w-[90%]">
                {nfcError}
              </p>
            )}
            <p className="absolute bottom-[20%] left-1/2 -translate-x-1/2 text-xl font-semibold tracking-[4px] uppercase bg-white px-5 py-2.5 border border-[#FF4F00] animate-pulse">
              TAG YOUR PLAYER CARD
            </p>
            <p className="absolute bottom-[14%] left-1/2 -translate-x-1/2 text-sm text-[#666]">
              화면을 터치한 후 NFC 리더기에 카드를 태깅하세요
            </p>
          </motion.div>
        )}

        {/* ========== TERMINAL ========== */}
        {screen === 'terminal' && (
          <motion.div
            key="terminal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black flex flex-col justify-center items-center z-10 cursor-wait"
          >
            <LogoutTypewriter
              text="IDENTIFYING PLAYER... DATA MATCHING COMPLETE."
              color="white"
              onComplete={onTerminalComplete}
            />
          </motion.div>
        )}

        {/* ========== RESULT ========== */}
        {screen === 'result' && logoutData && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col justify-center items-center z-10 overflow-y-auto py-20"
          >
            <div className="w-[600px] relative">
              <div className="text-3xl font-bold text-[#222] mb-2 min-h-[40px]">
                수고하셨습니다, <span className="text-[#FF4F00] font-black text-4xl">{logoutData.nickname}</span> 님
              </div>
              <div
                className="h-1 bg-[#FF4F00] transition-all duration-1000 ease-out"
                style={{ width: lineDrawn ? '100%' : 0, boxShadow: '0 2px 5px rgba(255,79,0,0.4)' }}
              />
              <div
                className="overflow-hidden transition-[height] duration-[2000ms] ease-out border-b-[3px] border-[#FF4F00] bg-white shadow-xl"
                style={{ height: tableOpen ? 360 : 0 }}
              >
                <div className={`px-10 py-8 transition-opacity duration-1000 ${tableOpen ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="flex justify-between items-center py-4 text-xl font-medium">
                    <span className="text-[#666] font-bold">플레이 게임</span>
                    <span className="font-extrabold text-[#222] tracking-wider">{logoutData.gameName}</span>
                  </div>
                  <div className="flex justify-between items-center py-4 text-xl font-medium">
                    <span className="text-[#666] font-bold">최종 순위</span>
                    <span className="font-extrabold text-[#222] tracking-wider">
                      {logoutData.rank === 1 ? '1st' : logoutData.rank === 2 ? '2nd' : logoutData.rank === 3 ? '3rd' : `${logoutData.rank}th`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-4 text-xl font-medium">
                    <span className="text-[#666] font-bold">크레딧</span>
                    <span className="font-extrabold text-[#222] tracking-wider">
                      {logoutData.creditsBefore.toLocaleString()} + <span className="text-[#FF4F00]">({logoutData.creditGain.toLocaleString()})</span> = <span className="text-[#FF4F00]">{logoutData.creditsAfter.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              <p
                role="button"
                tabIndex={0}
                onClick={goToFeedback}
                onKeyDown={(e) => e.key === 'Enter' && goToFeedback()}
                className="mt-8 text-right text-xl font-semibold text-[#FF4F00] cursor-pointer hover:underline"
              >
                CONTINUE &gt;&gt;
              </p>
            </div>
          </motion.div>
        )}

        {/* ========== FEEDBACK ========== */}
        {screen === 'feedback' && logoutData && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center z-10 overflow-y-auto py-16 px-6"
          >
            <div className="w-full max-w-[800px]">
              <div className="mb-12">
                <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                  오늘 게임({logoutData.gameName})의 만족도는 어떠셨나요?
                </div>
                <div className="bg-white p-8 border border-gray-200 flex flex-col gap-2">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={q2Score}
                    onChange={(e) => {
                      setQ2Score(Number(e.target.value));
                      setQ2Touched(true);
                    }}
                    className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF4F00] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,79,0,0.5)]"
                  />
                  <div className="flex justify-between font-semibold text-[#666] mt-1">
                    <span>0 (불만족)</span>
                    <span className="text-[#FF4F00] text-2xl font-extrabold">{q2Score}</span>
                    <span>10 (매우 만족)</span>
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <div className="text-2xl font-extrabold mb-5 border-l-4 border-[#FF4F00] pl-4">
                  지인들에게 DO:LAB NEON PROJECT를 추천하시겠습니까?
                </div>
                <div className="bg-white p-8 border border-gray-200 flex flex-col gap-2">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={q3Score}
                    onChange={(e) => {
                      setQ3Score(Number(e.target.value));
                      setQ3Touched(true);
                    }}
                    className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF4F00] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,79,0,0.5)]"
                  />
                  <div className="flex justify-between font-semibold text-[#666] mt-1">
                    <span>0 (비추천)</span>
                    <span className="text-[#FF4F00] text-2xl font-extrabold">{q3Score}</span>
                    <span>10 (강력 추천)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={finishFeedback}
                disabled={!canSubmitFeedback}
                className={`w-full py-6 text-3xl font-extrabold border-none transition-all ${
                  canSubmitFeedback ? 'bg-[#FF4F00] text-white cursor-pointer' : 'bg-gray-300 text-white cursor-not-allowed'
                }`}
              >
                테스트 종료
              </button>
            </div>
          </motion.div>
        )}

        {/* ========== FINAL ========== */}
        {screen === 'final' && logoutData && (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex flex-col justify-center items-center z-20 cursor-pointer backdrop-blur-sm"
            onClick={resetToStart}
          >
            <div
              className="bg-white p-12 text-center border-4 border-[#FF4F00] max-w-[600px] mx-4 pointer-events-none"
            >
              <p className="text-2xl font-bold leading-relaxed mb-5">
                감사합니다, {logoutData.nickname} 님
                <br />
                모든 테스트가 종료되었습니다.
              </p>
              <p className="text-sm text-gray-500 mt-5">화면을 터치하면 초기화면으로 이동합니다.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function LogoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">로딩 중...</div>}>
      <LogoutContent />
    </Suspense>
  );
}

function LogoutTypewriter({
  text,
  color = 'white',
  onComplete,
}: {
  text: string;
  color?: 'white' | 'orange';
  onComplete?: () => void;
}) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);
  const isWhite = color === 'white';
  const shadowColor = isWhite ? 'rgba(255,255,255,0.6)' : '#FF4F00';
  const cursorColor = isWhite ? 'white' : '#FF4F00';

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i < text.length) {
        setDisplay(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(id);
        setDone(true);
      }
    }, 50);
    return () => clearInterval(id);
  }, [text]);

  useEffect(() => {
    if (done && onComplete) onComplete();
  }, [done, onComplete]);

  return (
    <div
      className="text-4xl tracking-wider text-center leading-relaxed whitespace-pre-line text-white"
      style={{ textShadow: `0 0 10px ${shadowColor}` }}
    >
      {display}
      {!done && (
        <span
          className="inline-block w-3 h-9 ml-1 animate-pulse align-text-bottom"
          style={{ backgroundColor: cursorColor }}
        />
      )}
    </div>
  );
}
