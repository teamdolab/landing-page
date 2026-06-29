'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import './logout-styles.css';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveStationAccess, type StationAccessState } from '@/lib/station-access';

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

type ReturnIntent = 'yes' | 'maybe' | 'no';

function LogoutBlockedMessage({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-screen overflow-hidden bg-[#F2F4F6] relative font-body flex items-center justify-center">
      <p className="text-xl font-semibold text-[#222] px-6 text-center">{message}</p>
    </main>
  );
}

function LogoutContent() {
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get('gameId') ?? '';
  const stationId = searchParams.get('station_id') ?? '';
  const urlSessionId = searchParams.get('sessionId') ?? '';
  const [gameId, setGameId] = useState(urlGameId);
  const [sessionId, setSessionId] = useState(urlSessionId);
  const [accessState, setAccessState] = useState<StationAccessState>(() => {
    if (stationId) return { status: 'loading' };
    if (urlGameId) return { status: 'ready', gameId: urlGameId, sessionId: urlSessionId };
    return { status: 'invalid' };
  });

  const [screen, setScreen] = useState<Screen>('nfc');
  const [nfcError, setNfcError] = useState('');
  const [logoutData, setLogoutData] = useState<LogoutData | null>(null);
  const [nps, setNps] = useState(7);
  const [returnIntent, setReturnIntent] = useState<ReturnIntent | null>(null);
  const [showTouchText, setShowTouchText] = useState(false);
  const [lineDrawn, setLineDrawn] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [lastNfcId, setLastNfcId] = useState('');
  const nfcInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!stationId) {
      if (urlGameId) {
        setGameId(urlGameId);
        setSessionId(urlSessionId);
        setAccessState({ status: 'ready', gameId: urlGameId, sessionId: urlSessionId });
      } else {
        setAccessState({ status: 'invalid' });
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const resolved = await resolveStationAccess(stationId);
      if (cancelled) return;
      setAccessState(resolved);
      if (resolved.status === 'ready') {
        setGameId(resolved.gameId);
        setSessionId(resolved.sessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stationId, urlGameId, urlSessionId]);

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

  // 퀵 피드백 제출 (비차단) + logout-complete 정산
  const finishFeedback = useCallback(async (skipFeedback = false) => {
    setShowTouchText(false);

    // 정산: logout-complete
    if (gameId && lastNfcId) {
      try {
        await fetch(`/api/game/${encodeURIComponent(gameId)}/logout-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nfc_id: lastNfcId }),
        });
      } catch {
        // 무시
      }
    }

    // 퀵 피드백 저장 (비차단, 실패해도 무시)
    if (!skipFeedback && gameId) {
      fetch('/api/feedback/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          session_id: sessionId || undefined,
          nfc_id: lastNfcId || undefined,
          nps,
          return_intent: returnIntent,
        }),
      }).catch(() => {});
    }

    showScreen('final');
  }, [gameId, lastNfcId, sessionId, nps, returnIntent, showScreen]);

  const resetToStart = useCallback(() => {
    setLogoutData(null);
    setLastNfcId('');
    setNps(7);
    setReturnIntent(null);
    setShowTouchText(false);
    setLineDrawn(false);
    setTableOpen(false);
    showScreen('nfc');
  }, [showScreen]);

  const keyCodeToHexChar = (e: React.KeyboardEvent): string | null => {
    const code = e.code;
    if (code?.startsWith('Digit')) return code.slice(-1);
    const map: Record<string, string> = { KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e', KeyF: 'f' };
    return map[code ?? ''] ?? null;
  };

  if (accessState.status === 'loading') {
    return <LogoutBlockedMessage message="로딩 중..." />;
  }
  if (accessState.status === 'invalid') {
    return <LogoutBlockedMessage message="잘못된 접근입니다" />;
  }
  if (accessState.status === 'no_game') {
    return <LogoutBlockedMessage message="켜진 게임이 없습니다" />;
  }

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
              <p className="mt-2 text-right text-sm text-[#999]">
                피드백을 남기면 다음 시즌 운영에 반영됩니다
              </p>
            </div>
          </motion.div>
        )}

        {/* ========== FEEDBACK (퀵 피드백: NPS + 재방문 의향) ========== */}
        {screen === 'feedback' && logoutData && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-10 px-6"
          >
            <div className="w-full max-w-[560px]">
              <div className="text-2xl font-extrabold mb-1 border-l-4 border-[#FF4F00] pl-4">
                빠른 피드백
              </div>
              <p className="text-sm text-[#888] pl-4 mb-8">10초면 됩니다. 건너뛰기도 가능합니다.</p>

              {/* NPS 슬라이더 */}
              <div className="bg-white border border-gray-200 p-6 mb-5">
                <p className="font-bold text-[#222] mb-4 text-base">
                  친구에게 DO:LAB NEON을 추천할 가능성은? (0–10)
                </p>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={nps}
                  onChange={(e) => setNps(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF4F00] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,79,0,0.5)]"
                />
                <div className="flex justify-between text-sm text-[#666] mt-2">
                  <span>0 (전혀 없음)</span>
                  <span className="text-[#FF4F00] text-xl font-extrabold">{nps}</span>
                  <span>10 (강력 추천)</span>
                </div>
              </div>

              {/* 재방문 의향 */}
              <div className="bg-white border border-gray-200 p-6 mb-8">
                <p className="font-bold text-[#222] mb-4 text-base">다음 시즌에도 올 의향이 있나요?</p>
                <div className="flex gap-3">
                  {([
                    { value: 'yes', label: '올게요' },
                    { value: 'maybe', label: '아마도' },
                    { value: 'no', label: '글쎄요' },
                  ] as { value: ReturnIntent; label: string }[]).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReturnIntent(value)}
                      className={`flex-1 py-3 text-base font-bold border-2 transition-all cursor-pointer ${
                        returnIntent === value
                          ? 'bg-[#FF4F00] text-white border-[#FF4F00]'
                          : 'bg-white text-[#444] border-gray-300 hover:border-[#FF4F00] hover:text-[#FF4F00]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => finishFeedback(true)}
                  className="flex-[1] py-4 text-base font-semibold border border-gray-300 text-[#888] bg-white cursor-pointer hover:bg-gray-50"
                >
                  건너뛰기
                </button>
                <button
                  type="button"
                  onClick={() => finishFeedback(false)}
                  className="flex-[3] py-4 text-xl font-extrabold bg-[#FF4F00] text-white border-none cursor-pointer hover:bg-[#e64700]"
                >
                  제출하고 종료
                </button>
              </div>
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
