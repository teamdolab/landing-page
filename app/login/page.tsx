'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, type UserInfo } from '@/lib/supabase';

type Screen = 'intro' | 'pin' | 'nickname' | 'password' | 'nfc' | 'success';

export default function LoginPage() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [pin, setPin] = useState('');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [selectedNickname, setSelectedNickname] = useState('');
  const [password, setPassword] = useState('');
  const [pinError, setPinError] = useState(false);
  const [nicknameError, setNicknameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showScreen = useCallback((id: Screen) => {
    setScreen(id);
  }, []);


  const handleKeypadInput = (key: string, value: string, setter: (v: string) => void, maxLen: number) => {
    if (value.length < maxLen) setter(value + key);
  };

  const handleKeypadDelete = (value: string, setter: (v: string) => void) => {
    if (value.length > 0) setter(value.slice(0, -1));
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
      const { data, error } = await supabase
        .from('user_info')
        .select('*')
        .eq('pin', pin);

      if (error) {
        console.error('Supabase error:', error);
        setPinError(true);
        setErrorMessage(error.message || '조회에 실패했습니다.');
        return;
      }
      if (!data || data.length === 0) {
        setPinError(true);
        setErrorMessage('일치하는 회원이 없습니다. (PIN 확인 또는 가입 필요)');
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
      return;
    }
    if (!selectedUser) {
      setPasswordError(true);
      return;
    }
    // TODO: 실제 배포 시 bcrypt로 해시 비교. 테스트용 평문 비교
    if (selectedUser.password === password) {
      setPasswordError(false);
      showScreen('nfc');
    } else {
      setPasswordError(true);
    }
  };

  const processNFC = () => {
    showScreen('success');
  };

  const resetToStart = () => {
    setPin('');
    setUsers([]);
    setSelectedUser(null);
    setSelectedNickname('');
    setPassword('');
    setPinError(false);
    setNicknameError(false);
    setPasswordError(false);
    setErrorMessage('');
    showScreen('intro');
  };

  const goBack = (target: Screen) => {
    setPinError(false);
    setNicknameError(false);
    setPasswordError(false);
    showScreen(target);
  };

  const handleNfcBack = () => goBack('password');

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-[#F2F4F6] relative font-sans">
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
        <div className="absolute top-3 left-12 font-mono text-sm font-extrabold tracking-wider text-[#222] opacity-60">
          DO:LAB | REG_TERMINAL
        </div>
        <div className="absolute top-3 right-12 flex items-center gap-2 font-mono text-sm text-[#222] opacity-60">
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
            <div className="relative w-[220px] h-[220px] flex justify-center items-center mb-16">
              <div
                className="absolute inset-0 border-2 border-dashed border-black/10 rounded-full animate-spin"
                style={{ animationDuration: '10s' }}
              />
              <div className="relative z-10 w-[180px] h-[180px] flex items-center justify-center">
                <img
                  src="/dolab-logo.png"
                  alt="DO:LAB"
                  width={180}
                  height={180}
                  className="object-contain drop-shadow-md w-[180px] h-[180px]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling;
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div
                  className="hidden w-[180px] h-[180px] bg-[#FF4F00] items-center justify-center font-mono text-2xl font-extrabold text-[#222]"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    filter: 'drop-shadow(0 0 15px rgba(255, 79, 0, 0.4))',
                  }}
                >
                  DO:LAB
                </div>
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
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none font-mono text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="flex-[2] flex flex-col justify-center items-center border-r border-black/10">
              <div className="relative w-[500px] p-10 text-center mb-8 bg-white border border-[#ccc] shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
                <div className="absolute top-[-1px] left-5 w-10 h-0.5 bg-[#FF4F00]" />
                <div className="absolute bottom-1.5 right-2.5 font-mono text-[10px] text-[#ccc]">
                  INPUT_TYPE: INT
                </div>
                <div className="text-lg font-extrabold tracking-wider text-[#FF4F00] mb-2 flex justify-between font-mono">
                  CODE NUMBER <span>[ 4-DIGIT ]</span>
                </div>
                <div
                  className={`text-5xl font-semibold tracking-[5px] min-h-[70px] pb-2.5 border-b-2 font-mono transition-colors ${
                    pinError ? 'text-[#FF4F00] border-[#FF4F00] animate-login-shake' : 'text-[#222] border-[#ddd]'
                  }`}
                >
                  {pin.padEnd(4, '-')}
                </div>
                <button
                  type="button"
                  onClick={submitPin}
                  disabled={loading}
                  className="mt-6 py-3 px-12 bg-[#222] text-white font-mono text-lg cursor-pointer hover:bg-[#FF4F00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                >
                  {loading ? '...' : 'ENTER'}
                </button>
              </div>
              {errorMessage && (
                <p className="font-mono text-sm text-[#FF4F00] mt-2">{errorMessage}</p>
              )}
              <p className="font-mono text-base font-semibold tracking-wider text-[#666] animate-pulse mt-2">
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
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none font-mono text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="relative w-[500px] p-10 text-center mb-8 bg-white border border-[#ccc] shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
              <div className="absolute top-[-1px] left-5 w-10 h-0.5 bg-[#FF4F00]" />
              <div className="text-lg font-extrabold tracking-wider text-[#FF4F00] mb-4 font-mono">
                NICKNAME <span className="text-[#222]">[ SELECT ]</span>
              </div>
              <select
                value={selectedNickname}
                onChange={(e) => {
                  setSelectedNickname(e.target.value);
                  setNicknameError(false);
                }}
                className={`w-full py-4 px-4 text-xl font-mono border-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#FF4F00] ${
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
                className="mt-6 py-3 px-12 bg-[#222] text-white font-mono text-lg cursor-pointer hover:bg-[#FF4F00] transition-colors"
                style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
              >
                ENTER
              </button>
            </div>
            <p className="font-mono text-base font-semibold tracking-wider text-[#666]">
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
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none font-mono text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="flex-[2] flex flex-col justify-center items-center border-r border-black/10">
              <div className="relative w-[500px] p-10 text-center mb-8 bg-white border border-[#ccc] shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
                <div className="absolute top-[-1px] left-5 w-10 h-0.5 bg-[#FF4F00]" />
                <div className="absolute bottom-1.5 right-2.5 font-mono text-[10px] text-[#ccc]">
                  SECURE_LEVEL: HIGH
                </div>
                <div className="text-lg font-extrabold tracking-wider text-[#FF4F00] mb-2 flex justify-between font-mono">
                  PASSWORD <span>[ 4-DIGIT ]</span>
                </div>
                <div
                  className={`text-5xl font-semibold tracking-[5px] min-h-[70px] pb-2.5 border-b-2 font-mono ${
                    passwordError ? 'text-[#FF4F00] border-[#FF4F00]' : 'text-[#222] border-[#ddd]'
                  }`}
                >
                  {password.replace(/./g, '●').padEnd(4, '-')}
                </div>
                <button
                  type="button"
                  onClick={submitPassword}
                  className="mt-6 py-3 px-12 bg-[#222] text-white font-mono text-lg cursor-pointer hover:bg-[#FF4F00] transition-colors"
                  style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                >
                  ENTER
                </button>
              </div>
              <p className="font-mono text-base font-semibold tracking-wider text-[#666] animate-pulse">
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
            onClick={processNFC}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNfcBack();
              }}
              className="absolute top-20 left-10 z-[999] flex items-center gap-2 bg-transparent border-none font-mono text-xl font-semibold text-[#222] cursor-pointer opacity-60 hover:opacity-100 hover:text-[#FF4F00] transition-all"
            >
              ← BACK
            </button>
            <div className="relative flex justify-center items-center mb-16">
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
            <p className="text-xl font-semibold tracking-[4px] uppercase bg-white px-5 py-2.5 border border-[#FF4F00] animate-pulse">
              TAG YOUR PLAYER CARD
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
            className="fixed inset-0 bg-black text-[#FF4F00] flex flex-col justify-center items-center z-10 cursor-pointer font-mono"
            onClick={resetToStart}
          >
            <TypewriterText text="ACCESS GRANTED.\nWELCOME BACK, PLAYER." />
          </motion.div>
        )}
      </AnimatePresence>

    </main>
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
          className="aspect-[1/1.2] border border-[#ccc] bg-white font-mono text-2xl font-semibold text-[#222] cursor-pointer hover:bg-[#FF4F00] hover:text-white hover:border-[#FF4F00] transition-colors active:bg-[#FF4F00] active:text-white"
          style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        onClick={onDelete}
        className="aspect-[1/1.2] border border-[#ccc] bg-white font-mono text-lg cursor-pointer hover:bg-[#FF4F00] hover:text-white hover:border-[#FF4F00] transition-colors"
        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
      >
        DEL
      </button>
      <button
        type="button"
        onClick={() => onInput('0')}
        className="aspect-[1/1.2] border border-[#ccc] bg-white font-mono text-2xl font-semibold text-[#222] cursor-pointer hover:bg-[#FF4F00] hover:text-white hover:border-[#FF4F00] transition-colors"
        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
      >
        0
      </button>
      <button
        type="button"
        onClick={onEnter}
        className="aspect-[1/1.2] border border-[#FF4F00] bg-white font-mono text-2xl font-extrabold text-[#FF4F00] cursor-pointer hover:bg-[#FF4F00] hover:text-white transition-colors"
        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
      >
        OK
      </button>
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);

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

  return (
    <div className="text-4xl tracking-wider text-center leading-relaxed whitespace-pre-line" style={{ textShadow: '0 0 10px #FF4F00' }}>
      {display}
      {!done && <span className="inline-block w-3 h-9 bg-[#FF4F00] ml-1 animate-pulse align-text-bottom" />}
    </div>
  );
}
