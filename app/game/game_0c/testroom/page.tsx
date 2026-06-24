'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Game0cBoothState, Game0cVariationChoice } from '@/lib/game-0c-types';
import './game-0c-testroom.css';

type Screen = 'home' | 'variation' | 'contact' | 'force';
type ResultKind = 'success' | 'error' | 'info';

const KR_TO_HEX: Record<string, string> = {
  'ㅊ': 'c', 'ㅁ': 'a', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅠ': 'b',
};

function cleanNfcInput(raw: string): string {
  let s = String(raw);
  for (const [k, v] of Object.entries(KR_TO_HEX)) {
    s = s.replaceAll(k, v);
  }
  return s.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}

function keyCodeToHexChar(e: React.KeyboardEvent): string | null {
  const code = e.code;
  if (code.startsWith('Digit')) return code.replace('Digit', '');
  if (code.startsWith('Key')) {
    const ch = code.replace('Key', '').toUpperCase();
    if ('ABCDEF'.includes(ch)) return ch;
  }
  return null;
}

function stateLabel(state: string): string {
  if (state === 'human') return '인간';
  if (state === 'doctor') return '의사';
  if (state === 'zombie') return '좀비';
  return state;
}

function NfcGate({
  prompt,
  sub,
  sessionId,
  disabled,
  onIdentified,
  onError,
}: {
  prompt: string;
  sub?: string;
  sessionId: string;
  disabled?: boolean;
  onIdentified: (playerNumber: number) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.setAttribute('data-nfc-buffer', '');
    }
  };

  const processNfc = useCallback(
    async (uid: string) => {
      const trimmed = cleanNfcInput(uid);
      if (!trimmed || trimmed.length < 7) return;
      if (submittingRef.current || disabled) return;
      submittingRef.current = true;
      setLoading(true);
      try {
        const res = await fetch('/api/game/game_0c/nfc-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, card_uid: trimmed }),
        });
        const j = await res.json();
        if (res.ok && j.player_number) {
          onIdentified(j.player_number);
        } else {
          onError(j.error || '등록되지 않은 카드입니다.');
        }
      } catch {
        onError('카드 조회 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
        submittingRef.current = false;
        clearInput();
      }
    },
    [disabled, onError, onIdentified, sessionId],
  );

  const scheduleAutoSubmit = useCallback(
    (val: string) => {
      if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
      autoSubmitRef.current = setTimeout(() => {
        autoSubmitRef.current = null;
        processNfc(val);
      }, 400);
    },
    [processNfc],
  );

  return (
    <div className="game0c-testroom-nfc" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoFocus
        lang="en"
        inputMode="none"
        className="game0c-testroom-hidden-input"
        aria-label="NFC 카드 ID 입력"
        disabled={disabled || loading}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (autoSubmitRef.current) {
              clearTimeout(autoSubmitRef.current);
              autoSubmitRef.current = null;
            }
            const val = (e.target as HTMLInputElement).value;
            if (val) processNfc(val);
            return;
          }
          const char = keyCodeToHexChar(e);
          if (char !== null) {
            e.preventDefault();
            const buf = (inputRef.current?.getAttribute('data-nfc-buffer') ?? '') + char;
            inputRef.current?.setAttribute('data-nfc-buffer', buf);
            (e.target as HTMLInputElement).value = buf;
            if (buf.length >= 7) scheduleAutoSubmit(buf);
          }
        }}
        onInput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          const hex = cleanNfcInput(val);
          if (hex.length >= 7) scheduleAutoSubmit(hex);
        }}
      />
      <div className="game0c-testroom-nfc-icon">📡</div>
      <p className="game0c-testroom-prompt">{prompt}</p>
      <p className="game0c-testroom-nfc-text">
        {loading ? '확인 중...' : 'TAG YOUR PLAYER CARD'}
      </p>
      {sub && <p className="game0c-testroom-sub">{sub}</p>}
    </div>
  );
}

function TestroomInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session')?.trim() ?? '';

  const [screen, setScreen] = useState<Screen>('home');
  const [boothState, setBoothState] = useState<Game0cBoothState | null>(null);
  const [contactStep, setContactStep] = useState<'nfc1' | 'nfc2'>('nfc1');
  const [variationPlayer, setVariationPlayer] = useState<number | null>(null);
  const [forceActor, setForceActor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [resultKind, setResultKind] = useState<ResultKind | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBoothState = useCallback(async () => {
    if (!sessionId) return null;
    const res = await fetch(
      `/api/game/game_0c/booth-state?session_id=${encodeURIComponent(sessionId)}`,
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || '상태 조회 실패');
    setBoothState(j as Game0cBoothState);
    return j as Game0cBoothState;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchBoothState().catch(() => {});
  }, [sessionId, fetchBoothState]);

  const showResult = useCallback((message: string, kind: ResultKind) => {
    setResultMsg(message);
    setResultKind(kind);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      if (sessionId) {
        fetch('/api/game/game_0c/clear-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        }).catch(() => {});
      }
      setScreen('home');
      setContactStep('nfc1');
      setVariationPlayer(null);
      setForceActor(null);
      setResultMsg(null);
      setResultKind(null);
      setBusy(false);
      fetchBoothState().catch(() => {});
    }, 3000);
  }, [fetchBoothState, sessionId]);

  const goHome = useCallback(async () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setScreen('home');
    setContactStep('nfc1');
    setVariationPlayer(null);
    setForceActor(null);
    setResultMsg(null);
    setResultKind(null);
    setBusy(false);
    if (sessionId) {
      try {
        await fetch('/api/game/game_0c/clear-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch {
        /* ignore */
      }
      fetchBoothState().catch(() => {});
    }
  }, [fetchBoothState, sessionId]);

  const handleVariationNfc = async (playerNumber: number) => {
    setVariationPlayer(playerNumber);
  };

  const handleVariationChoice = async (choice: Game0cVariationChoice) => {
    if (!variationPlayer || !boothState?.round) return;
    setBusy(true);
    try {
      const res = await fetch('/api/game/game_0c/variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          round: boothState.round,
          player: variationPlayer,
          choice,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showResult(j.error || '변신 실패', 'error');
        return;
      }
      if (j.success_variation === false) {
        showResult(`현재 상태: ${stateLabel(j.probed_state)}`, 'info');
      } else {
        showResult('변신 완료', 'success');
      }
    } catch {
      showResult('네트워크 오류', 'error');
    }
  };

  const handleContactNfc1 = async (playerNumber: number) => {
    setBusy(true);
    try {
      const res = await fetch('/api/game/game_0c/set-pending-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, player_number: playerNumber }),
      });
      const j = await res.json();
      if (!res.ok) {
        showResult(j.error || '대기 상태 저장 실패', 'error');
        return;
      }
      setContactStep('nfc2');
      setBusy(false);
      await fetchBoothState();
    } catch {
      showResult('네트워크 오류', 'error');
    }
  };

  const handleContactNfc2 = async (playerNumber: number) => {
    const state = boothState ?? (await fetchBoothState());
    const playerA = state?.pending?.player_a;
    if (!playerA || !state?.round) {
      showResult('첫 번째 플레이어 대기 상태가 없습니다', 'error');
      return;
    }
    if (playerA === playerNumber) {
      showResult('서로 다른 플레이어를 태그하세요', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/game/game_0c/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          round: state.round,
          player_a: playerA,
          player_b: playerNumber,
          contact_type: 'normal',
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showResult(j.error || '접촉 실패', 'error');
        return;
      }
      await fetch('/api/game/game_0c/clear-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      showResult('접촉 완료', 'success');
    } catch {
      showResult('네트워크 오류', 'error');
    }
  };

  const handleForceNfc = async (playerNumber: number) => {
    setBusy(true);
    try {
      const state = await fetchBoothState();
      const isCandidate = (state?.force_candidates ?? []).some((c) => c.player === playerNumber);
      if (!isCandidate) {
        showResult('강제접촉 권한이 없습니다', 'error');
        return;
      }
      setForceActor(playerNumber);
      setBusy(false);
    } catch {
      showResult('상태 조회 실패', 'error');
    }
  };

  const handleForceTarget = async (target: number) => {
    if (!forceActor || !boothState?.round) return;
    setBusy(true);
    try {
      const res = await fetch('/api/game/game_0c/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          round: boothState.round,
          player_a: forceActor,
          player_b: target,
          contact_type: 'force',
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showResult(j.error || '강제접촉 실패', 'error');
        return;
      }
      showResult('강제접촉 완료', 'success');
    } catch {
      showResult('네트워크 오류', 'error');
    }
  };

  const startContact = async () => {
    setResultMsg(null);
    setResultKind(null);
    try {
      const state = await fetchBoothState();
      if (state?.pending?.type === 'normal_contact') {
        setContactStep('nfc2');
      } else {
        setContactStep('nfc1');
      }
      setScreen('contact');
    } catch {
      showResult('상태 조회 실패', 'error');
    }
  };

  if (!sessionId) {
    return (
      <div className="game0c-testroom-empty">
        <h1>세션 ID 필요</h1>
        <p>URL에 ?session=세션ID 를 붙여 접속하세요.</p>
      </div>
    );
  }

  if (resultMsg && resultKind) {
    return (
      <div className="game0c-testroom-root">
        <main className="game0c-testroom-main">
          <p className={`game0c-testroom-result game0c-testroom-result-${resultKind}`}>
            {resultMsg}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="game0c-testroom-root">
      <header className="game0c-testroom-header">
        <div>
          <div className="game0c-testroom-title">좀비게임 · 부스</div>
          <div className="game0c-testroom-session">{sessionId}</div>
        </div>
        {screen !== 'home' && (
          <button type="button" className="game0c-testroom-back" onClick={goHome}>
            뒤로
          </button>
        )}
      </header>

      <main className="game0c-testroom-main">
        {screen === 'home' && (
          <div className="game0c-testroom-actions">
            <p className="game0c-testroom-prompt">무엇을 하시겠습니까?</p>
            <button
              type="button"
              className="game0c-testroom-btn"
              onClick={() => {
                setResultMsg(null);
                setResultKind(null);
                setVariationPlayer(null);
                setScreen('variation');
              }}
            >
              변신
            </button>
            <button type="button" className="game0c-testroom-btn" onClick={startContact}>
              접촉
            </button>
            <button
              type="button"
              className="game0c-testroom-btn game0c-testroom-btn-secondary"
              onClick={() => {
                setResultMsg(null);
                setResultKind(null);
                setForceActor(null);
                setScreen('force');
              }}
            >
              강제접촉
            </button>
          </div>
        )}

        {screen === 'variation' && variationPlayer == null && (
          <NfcGate
            sessionId={sessionId}
            prompt="카드를 태그하세요"
            sub="화면을 터치한 후 NFC 리더기에 카드를 태깅하세요"
            disabled={busy}
            onIdentified={handleVariationNfc}
            onError={(msg) => showResult(msg, 'error')}
          />
        )}

        {screen === 'variation' && variationPlayer != null && (
          <div className="game0c-testroom-actions">
            <p className="game0c-testroom-prompt">{variationPlayer}번 — 변신 선택</p>
            <button
              type="button"
              className="game0c-testroom-btn game0c-testroom-btn-choice"
              disabled={busy}
              onClick={() => handleVariationChoice('doctor')}
            >
              의사
            </button>
            <button
              type="button"
              className="game0c-testroom-btn game0c-testroom-btn-choice"
              disabled={busy}
              onClick={() => handleVariationChoice('zombie')}
            >
              좀비
            </button>
          </div>
        )}

        {screen === 'contact' && contactStep === 'nfc1' && (
          <NfcGate
            sessionId={sessionId}
            prompt="첫 번째 플레이어 — 카드를 태그하세요"
            sub="화면을 터치한 후 NFC 리더기에 카드를 태깅하세요"
            disabled={busy}
            onIdentified={handleContactNfc1}
            onError={(msg) => showResult(msg, 'error')}
          />
        )}

        {screen === 'contact' && contactStep === 'nfc2' && (
          <NfcGate
            sessionId={sessionId}
            prompt={
              boothState?.pending?.player_a
                ? `${boothState.pending.player_a}번 접촉 완료 — 두 번째 플레이어 카드를 태그하세요`
                : '두 번째 플레이어 — 카드를 태그하세요'
            }
            sub="화면을 터치한 후 NFC 리더기에 카드를 태깅하세요"
            disabled={busy}
            onIdentified={handleContactNfc2}
            onError={(msg) => showResult(msg, 'error')}
          />
        )}

        {screen === 'force' && forceActor == null && (
          <NfcGate
            sessionId={sessionId}
            prompt="카드를 태그하세요 (강제접촉 실행자)"
            sub="화면을 터치한 후 NFC 리더기에 카드를 태깅하세요"
            disabled={busy}
            onIdentified={handleForceNfc}
            onError={(msg) => showResult(msg, 'error')}
          />
        )}

        {screen === 'force' && forceActor != null && (
          <>
            <p className="game0c-testroom-prompt">실행자 {forceActor}번 — 대상 선택</p>
            <div className="game0c-testroom-target-grid">
              {(boothState?.player_numbers ?? [])
                .filter((n) => n !== forceActor)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="game0c-testroom-target-btn"
                    disabled={busy}
                    onClick={() => handleForceTarget(n)}
                  >
                    {n}
                  </button>
                ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function Game0cTestroomPage() {
  return (
    <Suspense
      fallback={
        <div className="game0c-testroom-empty">
          <p>로딩 중...</p>
        </div>
      }
    >
      <TestroomInner />
    </Suspense>
  );
}
