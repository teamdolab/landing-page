'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, type UserInfo } from '@/lib/supabase';

type Screen = 'intro' | 'pin' | 'nickname' | 'password' | 'nfc' | 'success';

function LoginContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId') ?? '';
  const [screen, setScreen] = useState<Screen>('intro');
  const [pin, setPin] = useState('');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [selectedNickname, setSelectedNickname] = useState('');
  const [password, setPassword] = useState('');
  const [pinError, setPinError] = useState(false);
  const [nicknameError, setNicknameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTouchText, setShowTouchText] = useState(false);
  const [nfcError, setNfcError] = useState('');
  const nfcInputRef = useRef<HTMLInputElement>(null);
  const nfcAutoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showScreen = useCallback((id: Screen) => {
    setScreen(id);
  }, []);

  useEffect(() => {
    if (screen === 'success') setShowTouchText(false);
  }, [screen]);

  useEffect(() => {
    if (screen === 'nfc') {
      setNfcError('');
      nfcInputRef.current?.setAttribute('data-nfc-buffer', '');
      if (nfcAutoSubmitRef.current) {
        clearTimeout(nfcAutoSubmitRef.current);
        nfcAutoSubmitRef.current = null;
      }
      const t = setTimeout(() => nfcInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [screen]);


  const handleKeypadInput = (key: string, value: string, setter: (v: string) => void, maxLen: number) => {
    if (value.length < maxLen) setter(value + key);
  };

  const handleKeypadDelete = (_value: string, setter: (v: string) => void) => {
    setter('');
  };

  const submitPin = async () => {
    if (pin.length !== 4) {
      setPinError(true);
      return;
    }
    setPinError(false);
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.rpc('get_users_by_pin', {
        p_pin: pin,
      });

      if (error) {
        console.error('Supabase error:', error);
        setPinError(true);
        setErrorMessage(error.message || '조회에 실패했습니다.');
        return;
      }
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setPinError(true);
        setErrorMessage('일치하는 회원이 없습니다.');
        return;
      }
      setUsers(data as UserInfo[]);
      setSelectedNickname('');
      setSelectedUser(null);
      showScreen('nickname');
    } catch (err: unknown) {
      setPinError(true);
      const msg = err instanceof Error ? err.message : '조회에 실패했습니다.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitNickname = () => {
    const user = users.find((u) => u.nickname === selectedNickname);
    if (user) {
      setNicknameError(false);
      setSelectedUser(user);
      setPassword('');
      showScreen('password');
    } else {
      setNicknameError(true);
    }
  };

  const submitPassword = () => {
    if (password.length !== 4) {
      setPasswordError(true);
      setPasswordErrorMessage('패스워드가 틀렸습니다.');
      return;
    }
    if (!selectedUser) {
      setPasswordError(true);
      setPasswordErrorMessage('패스워드가 틀렸습니다.');
      return;
    }
    // TODO: 실제 배포 시 bcrypt로 해시 비교. 테스트용 평문 비교
    if (selectedUser.password === password) {
      setPasswordError(false);
      setPasswordErrorMessage('');
      showScreen('nfc');
    } else {
      setPasswordError(true);
      setPasswordErrorMessage('패스워드가 틀렸습니다.');
    }
  };

  const processNFC = useCallback(async (nfcIdRaw: string) => {
    const nfcId = nfcIdRaw?.trim();
    if (!nfcId) return;

    if (!gameId) {
      setNfcError('게임 정보가 없습니다. 컨트롤 페이지에서 로그인 화면을 열어주세요.');
      return;
    }
    if (!selectedUser) return;

    setNfcError('');
    setLoading(true);
    try {
      const apiUrl = `${window.location.origin}/api/game/${encodeURIComponent(gameId)}/register-player`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          nfc_id: nfcId,
        }),
      });
      let data: { error?: string };
      try {
        data = await res.json();
      } catch {
        const msg = res.ok ? '응답 처리 중 오류가 발생했습니다.' : `서버 오류 (${res.status})`;
        setNfcError(msg);
        return;
      }

      if (res.ok && (data as { success?: boolean }).success === true) {
        showScreen('success');
      } else {
        setNfcError((data as { error?: string }).error || '등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('NFC 등록 fetch 오류:', err);
      setNfcError('네트워크 오류가 발생했습니다. 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedUser]);

  const resetToStart = () => {
    setPin('');
    setUsers([]);
    setSelectedUser(null);
    setSelectedNickname('');
    setPassword('');
    setPinError(false);
    setNicknameError(false);
    setPasswordError(false);
    setPasswordErrorMessage('');
    setErrorMessage('');
    setNfcError('');
    showScreen('intro');
  };

  const goBack = (target: Screen) => {
    setPinError(false);
    setNicknameError(false);
    setPasswordError(false);
    setPasswordErrorMessage('');
    showScreen(target);
  };

  const handleNfcBack = () => goBack('password');

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
        {/* ========== INTRO ========== */}
        {screen === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-10 cursor-pointer"
            onClick={() => showScreen('pin')}
          >
            <div className="w-[880px] h-[880px] flex items-center justify-center mb-16">
              <img
                src="/login-logo.png"
                alt="DO:LAB"
                width={880}
                height={880}
                className="object-contain drop-shadow-md w-[880px] h-[880px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div
                className="hidden w-[880px] h-[880px] bg-[#FF4F00] items-center justify-center text-2xl font-extrabold text-[#222]"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  filter: 'drop-shadow(0 0 15px rgba(255, 79, 0, 0.4))',
                }}
              >
                DO:LAB
              </div>
            </div>
            <p className="absolute bottom-[15%] text-xl font-semibold tracking-[4px] uppercase bg-white px-5 py-2.5 border border-[#FF4F00] animate-pulse">
              Touch screen to access
            </p>
          </motion.div>
        )}

        {/* ========== PIN ========== */}
        {screen === 'pin' && (
          <motion.div
            key="pin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-row z-10"
          >
            <button
              type="button"
              onClick={() => goBack('intro')}
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="flex-[2] flex flex-col justify-center items-center border-r border-black/10">
              <div className="relative w-[500px] p-10 text-center mb-8 bg-white border border-[#ccc] shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
                <div className="absolute top-[-1px] left-5 w-10 h-0.5 bg-[#FF4F00]" />
                <div className="text-lg font-extrabold tracking-wider text-[#FF4F00] mb-2 flex justify-between">
                  PIN NUMBER <span>[전화번호 뒷 4자리]</span>
                </div>
                <div
                  className={`text-5xl font-semibold tracking-[5px] min-h-[70px] pb-2.5 border-b-2 transition-colors ${
                    pinError ? 'text-[#FF4F00] border-[#FF4F00] animate-login-shake' : 'text-[#222] border-[#ddd]'
                  }`}
                >
                  {pin.padEnd(4, '-')}
                </div>
                <button
                  type="button"
                  onClick={submitPin}
                  disabled={loading}
                  className="mt-6 py-3 px-12 bg-[#222] text-white text-lg cursor-pointer hover:bg-[#FF4F00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                >
                  {loading ? '...' : 'ENTER'}
                </button>
              </div>
              {errorMessage && (
                <p className="text-sm text-[#FF4F00] mt-2">{errorMessage}</p>
              )}
              <p className="text-base font-semibold tracking-wider text-[#666] animate-pulse mt-2">
                ENTER YOUR PIN NUMBER
              </p>
            </div>
            <div className="flex-1 flex justify-center items-center bg-white/50">
              <Keypad
                value={pin}
                onInput={(n) => handleKeypadInput(n, pin, setPin, 4)}
                onDelete={() => handleKeypadDelete(pin, setPin)}
                onEnter={submitPin}
              />
            </div>
          </motion.div>
        )}

        {/* ========== NICKNAME SELECT ========== */}
        {screen === 'nickname' && (
          <motion.div
            key="nickname"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col justify-center items-center z-10"
          >
            <button
              type="button"
              onClick={() => goBack('pin')}
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="relative w-[500px] p-10 text-center mb-8 bg-white border border-[#ccc] shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
              <div className="absolute top-[-1px] left-5 w-10 h-0.5 bg-[#FF4F00]" />
              <div className="text-lg font-extrabold tracking-wider text-[#FF4F00] mb-4">
                NICKNAME
              </div>
              <select
                value={selectedNickname}
                onChange={(e) => {
                  setSelectedNickname(e.target.value);
                  setNicknameError(false);
                }}
                className={`w-full py-4 px-4 text-xl border-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#FF4F00] ${
                  nicknameError ? 'border-[#FF4F00]' : 'border-[#ddd]'
                }`}
                style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
              >
                <option value="">-- 닉네임 선택 --</option>
                {users.map((u) => (
                     <option key={u.id} value={u.nickname ?? ''}>
                    {u.nickname}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={submitNickname}
                className="mt-6 py-3 px-12 bg-[#222] text-white text-lg cursor-pointer hover:bg-[#FF4F00] transition-colors"
                style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
              >
                ENTER
              </button>
            </div>
            <p className="text-base font-semibold tracking-wider text-[#666]">
              SELECT YOUR NICKNAME
            </p>
          </motion.div>
        )}

        {/* ========== PASSWORD ========== */}
        {screen === 'password' && (
          <motion.div
            key="password"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-row z-10"
          >
            <button
              type="button"
              onClick={() => goBack('nickname')}
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="flex-[2] flex flex-col justify-center items-center border-r border-black/10">
              <div className="relative w-[500px] p-10 text-center mb-8 bg-white border border-[#ccc] shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
                <div className="absolute top-[-1px] left-5 w-10 h-0.5 bg-[#FF4F00]" />
                <div className="text-lg font-extrabold tracking-wider text-[#FF4F00] mb-2">
                  PASSWORD
                </div>
                <div
                  className={`text-5xl font-semibold tracking-[5px] min-h-[70px] pb-2.5 border-b-2 ${
                    passwordError ? 'text-[#FF4F00] border-[#FF4F00]' : 'text-[#222] border-[#ddd]'
                  }`}
                >
                  {password.replace(/./g, '●').padEnd(4, '-')}
                </div>
                <button
                  type="button"
                  onClick={submitPassword}
                  className="mt-6 py-3 px-12 bg-[#222] text-white text-lg cursor-pointer hover:bg-[#FF4F00] transition-colors"
                  style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                >
                  ENTER
                </button>
              </div>
              {passwordErrorMessage && (
                <p className="text-sm text-[#FF4F00] mt-2">{passwordErrorMessage}</p>
              )}
              <p className="text-base font-semibold tracking-wider text-[#666] animate-pulse">
                ENTER YOUR PASSWORD
              </p>
            </div>
            <div className="flex-1 flex justify-center items-center bg-white/50">
              <Keypad
                value={password}
                onInput={(n) => handleKeypadInput(n, password, setPassword, 4)}
                onDelete={() => handleKeypadDelete(password, setPassword)}
                onEnter={submitPassword}
                mask
              />
            </div>
          </motion.div>
        )}

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
            {/* NFC 리더기: keydown으로 물리 키 캡처 → 한영키 한글 입력 무시 */}
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
                  if (nfcAutoSubmitRef.current) {
                    clearTimeout(nfcAutoSubmitRef.current);
                    nfcAutoSubmitRef.current = null;
                  }
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
                    // Enter 없이 입력되는 NFC 리더기: 7자 이상이면 300ms 후 자동 제출
                    if (nfcAutoSubmitRef.current) clearTimeout(nfcAutoSubmitRef.current);
                    if (buf.length >= 7) {
                      nfcAutoSubmitRef.current = setTimeout(() => {
                        nfcAutoSubmitRef.current = null;
                        processNFC(buf);
                        nfcInputRef.current?.setAttribute('data-nfc-buffer', '');
                        (e.target as HTMLInputElement).value = '';
                      }, 300);
                    }
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={handleNfcBack}
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
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

        {/* ========== SUCCESS ========== */}
        {screen === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black text-white flex flex-col justify-center items-center gap-8 z-10 cursor-pointer"
            onClick={resetToStart}
          >
            <TypewriterText text="ACCESS GRANTED. WELCOME, PLAYER." color="white" onComplete={() => setShowTouchText(true)} />
            {showTouchText && (
              <p className="text-sm tracking-wider text-white/75 animate-pulse">TOUCH THE SCREEN</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F2F4F6] text-[#222]">로딩 중...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function Keypad({
  value,
  onInput,
  onDelete,
  onEnter,
  mask,
}: {
  value: string;
  onInput: (n: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  mask?: boolean;
}) {
  const nums = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-4 w-full max-w-[320px]">
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onInput(n)}
          className="aspect-[1/1.2] border border-[#ccc] bg-white text-2xl font-semibold text-[#222] cursor-pointer hover:bg-[#FF4F00] hover:text-white hover:border-[#FF4F00] transition-colors active:bg-[#FF4F00] active:text-white"
          style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        onClick={onDelete}
        className="aspect-[1/1.2] border border-[#ccc] bg-white text-lg cursor-pointer hover:bg-[#FF4F00] hover:text-white hover:border-[#FF4F00] transition-colors"
        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
      >
        DEL
      </button>
      <button
        type="button"
        onClick={() => onInput('0')}
        className="aspect-[1/1.2] border border-[#ccc] bg-white text-2xl font-semibold text-[#222] cursor-pointer hover:bg-[#FF4F00] hover:text-white hover:border-[#FF4F00] transition-colors"
        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
      >
        0
      </button>
      <button
        type="button"
        onClick={onEnter}
        className="aspect-[1/1.2] border border-[#FF4F00] bg-white text-2xl font-extrabold text-[#FF4F00] cursor-pointer hover:bg-[#FF4F00] hover:text-white transition-colors"
        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
      >
        OK
      </button>
    </div>
  );
}

function TypewriterText({ text, color = 'orange', onComplete }: { text: string; color?: 'orange' | 'white'; onComplete?: () => void }) {
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
    <div className="text-4xl tracking-wider text-center leading-relaxed whitespace-pre-line" style={{ textShadow: `0 0 10px ${shadowColor}` }}>
      {display}
      {!done && <span className="inline-block w-3 h-9 ml-1 animate-pulse align-text-bottom" style={{ backgroundColor: cursorColor }} />}
    </div>
  );
}
