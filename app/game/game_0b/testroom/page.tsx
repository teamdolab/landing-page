'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameLayout from '../components/GameLayout';
import { getPlayerRoleCore, type Game0bRow } from '@/lib/game-0b-types';
import { ACTION_CONFIG } from '@/lib/game-0b-action-config';
import { ActionCard } from '../components/ActionCard';

export default function Game0bTestroomPage() {
  return (
    <GameLayout role="testroom">
      {(game: Game0bRow, reload: () => void) => (
        <TestroomBottom game={game} reload={reload} />
      )}
    </GameLayout>
  );
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

/* ── NFC 게이트(대기) 화면 ── */
function NfcGate({ game, onIdentified }: { game: Game0bRow; onIdentified: (num: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const processNfc = useCallback(
    async (uid: string) => {
      const trimmed = uid.replace(/[^a-fA-F0-9]/g, '').trim();
      if (!trimmed || trimmed.length < 7) return;
      if (submittingRef.current) return;
      submittingRef.current = true;
      setError('');
      setLoading(true);
      try {
        const res = await fetch('/api/game/game_0b/nfc-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nfc_id: trimmed, session_id: game.session_id }),
        });
        const j = await res.json();
        if (res.ok && j.player_number) {
          onIdentified(j.player_number);
        } else {
          setError(j.error || '등록되지 않은 카드입니다.');
        }
      } catch {
        setError('카드 조회 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
        submittingRef.current = false;
      }
    },
    [onIdentified, game.session_id],
  );

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.setAttribute('data-nfc-buffer', '');
    }
  };

  const scheduleAutoSubmit = useCallback((val: string) => {
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    autoSubmitRef.current = setTimeout(() => {
      autoSubmitRef.current = null;
      processNfc(val);
      clearInput();
    }, 400);
  }, [processNfc]);

  return (
    <div
      className="bottom-panel"
      style={{ gridColumn: '1 / -1', cursor: 'pointer' }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="bottom-panel-label">플레이어 식별</div>
      <div className="bottom-panel-body">
        <div className="nfc-gate-body">
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoFocus
            lang="en"
            inputMode="none"
            className="absolute opacity-0"
            aria-label="NFC 카드 ID 입력"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (autoSubmitRef.current) {
                  clearTimeout(autoSubmitRef.current);
                  autoSubmitRef.current = null;
                }
                const val = (e.target as HTMLInputElement).value;
                if (val) {
                  processNfc(val);
                  clearInput();
                }
                return;
              }
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
              const hex = val.replace(/[^a-fA-F0-9]/g, '');
              if (hex.length >= 7) {
                scheduleAutoSubmit(hex);
              }
            }}
          />
          <div className="nfc-icon">📡</div>
          <div className="nfc-gate-text">
            {loading ? '확인 중...' : 'TAG YOUR PLAYER CARD'}
          </div>
          <span className="empty-text">
            화면을 터치한 후 NFC 리더기에 카드를 태깅하세요
          </span>
          {error && (
            <span style={{ color: '#c62828', fontWeight: 700, fontSize: 14 }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 캐릭터 초상화 (sprite sheet 크롭) ── */
const CHAR_INDEX: Record<string, number> = {
  '사령관':   0,
  '생존자':   1,
  '반군수장': 2,
  '혁명가':   2,
  '반군':     3,
  '외계인':   4,
};

function CharacterPortrait({ role }: { role: string }) {
  const totalChars = 5;
  const imageWidth = 677;
  const imageHeight = 369;
  const displayWidth = 130;
  const charWidth = imageWidth / totalChars; // ~135.4px per char
  const scale = displayWidth / charWidth;    // 1 char → 130px
  const bgWidth = imageWidth * scale;
  const bgHeight = imageHeight * scale;
  const displayHeight = Math.round(bgHeight * 0.75); // 상단 75% 표시

  const index = CHAR_INDEX[role] ?? 0;
  const xPercent = (index / (totalChars - 1)) * 100;

  return (
    <div
      style={{
        width: displayWidth,
        height: displayHeight,
        backgroundImage: 'url(/game-0b/characters.png)',
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${xPercent}% top`,
        backgroundRepeat: 'no-repeat',
        borderRadius: 12,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    />
  );
}

/* ── setup 페이즈: 역할 확인 화면 ── */
function RoleRevealPanel({
  game,
  playerNum,
  onDone,
}: {
  game: Game0bRow;
  playerNum: number;
  onDone: () => void;
}) {
  const { role } = getPlayerRoleCore(game, playerNum);

  const roleDescription: Record<string, string> = {
    '사령관': '생존자 진영의 리더',
    '생존자': '생존자 진영',
    '반군수장': '반군 진영의 리더',
    '반군': '반군 진영',
    '외계인': '외계인 진영',
  };

  const factionData = getFactionInfoData(game, playerNum, role);

  return (
    <>
      {/* 좌측: 캐릭터 초상화 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">{playerNum}번 플레이어</div>
        <div className="bottom-panel-body">
          {role
            ? <CharacterPortrait role={role} />
            : <span className="empty-text">미배정</span>
          }
        </div>
      </div>

      {/* 중앙: 직업명 + 진영 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">역할</div>
        <div className="bottom-panel-body" style={{ gap: 10 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#5a32b8', letterSpacing: '-0.5px' }}>
            {role ?? '미배정'}
          </div>
          {role && (
            <span style={{ color: '#aaa', fontSize: 13, textAlign: 'center' }}>
              {roleDescription[role] ?? ''}
            </span>
          )}
          <button
            type="button"
            className="action-end-btn"
            style={{ marginTop: 16 }}
            onClick={onDone}
          >
            확인 완료
          </button>
        </div>
      </div>

      {/* 우측: 알아야 하는 정보 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">기밀 정보</div>
        <div className="bottom-panel-body" style={{ gap: 8, alignItems: 'stretch' }}>
          {factionData ? (
            <>
              <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {factionData.title}
              </span>
              {factionData.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(232, 184, 75, 0.08)',
                    border: '1px solid rgba(232, 184, 75, 0.25)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#e8b84b' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <span className="empty-text" style={{ fontSize: 13 }}>
              알 수 있는 정보가 없습니다
            </span>
          )}
        </div>
      </div>
    </>
  );
}

type FactionInfoData = {
  title: string;
  items: { label: string; value: string }[];
} | null;

function getFactionInfoData(game: Game0bRow, playerNum: number, role: string | null): FactionInfoData {
  if (!role) return null;
  const pc = game.player_count ?? 12;

  if (role === '사령관') {
    for (let i = 1; i <= pc; i++) {
      const { role: r } = getPlayerRoleCore(game, i);
      if (r === '반군수장') {
        return {
          title: '기밀 정보',
          items: [{ label: '반군수장', value: `${i}번 플레이어` }],
        };
      }
    }
  }

  if (role === '반군수장') {
    const rebels: number[] = [];
    for (let i = 1; i <= pc; i++) {
      const { role: r } = getPlayerRoleCore(game, i);
      if (r === '반군') rebels.push(i);
    }
    return {
      title: '반군 목록',
      items: rebels.map((n) => ({ label: `${n}번`, value: '반군' })),
    };
  }

  if (role === '외계인') {
    const aliens: number[] = [];
    for (let i = 1; i <= pc; i++) {
      if (i === playerNum) continue;
      const { role: r } = getPlayerRoleCore(game, i);
      if (r === '외계인') aliens.push(i);
    }
    if (aliens.length > 0) {
      return {
        title: '동료 외계인',
        items: aliens.map((n) => ({ label: `${n}번`, value: '외계인' })),
      };
    }
  }

  return null;
}

function getFactionInfo(game: Game0bRow, playerNum: number, role: string | null): string | null {
  const data = getFactionInfoData(game, playerNum, role);
  if (!data) return null;
  return data.items.map(i => `${i.label} ${i.value}`).join(', ');
}

/* ── 밤 페이즈: 플레이어 액션 화면 ── */
function PlayerActionPanel({
  game,
  playerNum,
  reload,
  onEnd,
}: {
  game: Game0bRow;
  playerNum: number;
  reload: () => void;
  onEnd: () => void;
}) {
  const { role, core } = getPlayerRoleCore(game, playerNum);
  const [actionDone, setActionDone] = useState(false);
  const [detectUsed, setDetectUsed] = useState(false);
  const [hiddenTradeUsed, setHiddenTradeUsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<ActionDef | null>(null);
  const [targetPlayer, setTargetPlayer] = useState<number>(1);
  const [detectTargets, setDetectTargets] = useState<number[]>([]);

  const playerOptions = Array.from({ length: game.player_count ?? 12 }, (_, i) => i + 1).filter(n => n !== playerNum);

  useEffect(() => {
    setActionDone(false);
    setDetectUsed(false);
    setHiddenTradeUsed(false);
    setSearchResult(null);
    setMsg(null);
  }, [playerNum, game.current_round]);

  const handleSubmitAction = async (actionId: string, target?: number, extra?: Record<string, unknown>) => {
    setSubmitting(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        session_id: game.session_id,
        player_number: playerNum,
        action_type: actionId,
      };
      if (target != null) body.target_player = target;
      if (extra) body.extra_data = extra;

      const res = await fetch('/api/game/game_0b/night-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error || '액션 실패');
      } else {
        const isNonConsuming = actionId === 'detect' || actionId === 'hidden_trade';
        if (!isNonConsuming) {
          setActionDone(true);
        }
        if (actionId === 'detect') {
          setDetectUsed(true);
        }
        if (actionId === 'hidden_trade') {
          setHiddenTradeUsed(true);
        }
        if (actionId === 'search' && j.search_result) {
          setSearchResult(`${target}번 플레이어 → ${j.search_result}`);
        }
        setMsg(`${modalAction?.label ?? actionId} 완료`);
        setModalAction(null);
        reload();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmModal = () => {
    if (!modalAction) return;
    if (modalAction.id === 'detect') {
      handleSubmitAction('detect', undefined, { targets: detectTargets });
    } else if (modalAction.needsTarget) {
      handleSubmitAction(modalAction.id, targetPlayer);
    } else {
      handleSubmitAction(modalAction.id);
    }
  };

  const handleEndTurn = async () => {
    if (!actionDone) {
      await handleSubmitAction('skip');
    }
    onEnd();
  };

  const actions = getActionsForRole(role, game);

  return (
    <>
      {/* 좌측: 보유 코어 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">
          {playerNum}번 · 보유 코어
        </div>
        <div className="bottom-panel-body">
          <div style={{ fontFamily: 'var(--tech-font)', fontSize: 48, fontWeight: 900, color: '#5a32b8' }}>
            {core}
          </div>
          <span className="empty-text">{role ?? '역할 미배정'}</span>
        </div>
      </div>

      {/* 중앙: 액션 목록 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">액션</div>
        <div className="bottom-panel-body action-icon-grid">
          {actions.map((a) => {
            const disabled =
              submitting ||
              (actionDone && !a.nonConsuming) ||
              core < a.cost ||
              (a.id === 'detect' && detectUsed) ||
              (a.id === 'hidden_trade' && hiddenTradeUsed);
            const cfg = ACTION_CONFIG[a.id];
            if (!cfg) return null;
            return (
              <ActionCard
                key={a.id}
                icon={cfg.icon}
                label={a.label}
                color={cfg.color}
                cost={a.cost}
                disabled={disabled}
                onClick={() => {
                  setModalAction(a);
                  setTargetPlayer(playerOptions[0] ?? 1);
                  setDetectTargets([]);
                }}
              />
            );
          })}
          {searchResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(90, 50, 184, 0.15)',
              border: '1px solid #5a32b8', textAlign: 'center', marginTop: 4,
            }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>탐색 결과</span>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#e8b84b', marginTop: 2 }}>
                {searchResult}
              </div>
            </div>
          )}
          {msg && (
            <span style={{ fontSize: 13, color: '#5a32b8', fontWeight: 600, textAlign: 'center', marginTop: 4 }}>
              {msg}
            </span>
          )}
        </div>
      </div>

      {/* 우측: 액션 종료 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">액션 종료</div>
        <div className="bottom-panel-body">
          <button type="button" className="action-end-btn" onClick={handleEndTurn} disabled={submitting}>
            액션 종료
          </button>
          <span className="empty-text">종료 후 다음 플레이어가 입장합니다.</span>
        </div>
      </div>

      {/* 액션 모달 */}
      {modalAction && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setModalAction(null)}
        >
          <div
            style={{
              background: '#1e1340', padding: 24, borderRadius: 12, minWidth: 300,
              maxWidth: '90%', border: '1px solid #5a32b8',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {modalAction.label} {modalAction.cost > 0 && `(${modalAction.cost}코어)`}
            </h3>

            {modalAction.id === 'detect' ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 8 }}>
                  감지 대상 (최대 3명 선택)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {playerOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: '1px solid #5a32b8',
                        background: detectTargets.includes(n) ? '#5a32b8' : 'transparent',
                        color: '#fff', cursor: 'pointer', fontSize: 14,
                      }}
                      onClick={() => {
                        if (detectTargets.includes(n)) {
                          setDetectTargets(detectTargets.filter(t => t !== n));
                        } else if (detectTargets.length < 3) {
                          setDetectTargets([...detectTargets, n]);
                        }
                      }}
                    >
                      {n}번
                    </button>
                  ))}
                </div>
              </div>
            ) : modalAction.needsTarget ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 8 }}>
                  대상 플레이어
                </label>
                <select
                  value={targetPlayer}
                  onChange={(e) => setTargetPlayer(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: '#0d0820', border: '1px solid #5a32b8', color: '#fff', fontSize: 15,
                  }}
                >
                  {playerOptions.map((n) => (
                    <option key={n} value={n}>{n}번</option>
                  ))}
                </select>
              </div>
            ) : (
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 16 }}>
                {modalAction.label}을(를) 실행합니다.
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  background: '#5a32b8', color: '#fff', border: 'none',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}
                disabled={submitting || (modalAction.id === 'detect' && detectTargets.length === 0)}
                onClick={handleConfirmModal}
              >
                {submitting ? '처리 중...' : '확인'}
              </button>
              <button
                type="button"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  background: 'transparent', color: '#888', border: '1px solid #444',
                  fontWeight: 600, fontSize: 15, cursor: 'pointer',
                }}
                onClick={() => setModalAction(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type ActionDef = { id: string; label: string; cost: number; needsTarget: boolean; nonConsuming?: boolean };

function getActionsForRole(role: string | null, game: Game0bRow): ActionDef[] {
  if (!role) return [];

  const isRevolutionary = game.revolutionary_player_number != null;

  switch (role) {
    case '사령관':
      return [
        { id: 'detect', label: '감지', cost: 0, needsTarget: false, nonConsuming: true },
        { id: 'control', label: '통제', cost: 5, needsTarget: true },
        { id: 'mine', label: '채굴', cost: 0, needsTarget: false },
        { id: 'repair_survivor', label: '수리', cost: 1, needsTarget: false },
      ];
    case '생존자': {
      const base: ActionDef[] = [
        { id: 'search', label: '탐색', cost: 5, needsTarget: true },
        { id: 'mine', label: '채굴', cost: 0, needsTarget: false },
        { id: 'repair_survivor', label: '수리', cost: 1, needsTarget: false },
      ];
      if (isRevolutionary) {
        base.push({ id: 'assassinate', label: '암살', cost: 10, needsTarget: true });
      }
      return base;
    }
    case '반군수장':
      return [
        { id: 'search', label: '탐색', cost: 5, needsTarget: true },
        { id: 'assassinate', label: '암살', cost: 10, needsTarget: true },
        { id: 'hidden_trade', label: '은닉거래', cost: 0, needsTarget: true, nonConsuming: true },
        { id: 'mine', label: '채굴', cost: 0, needsTarget: false },
        { id: 'repair_rebel', label: '수리', cost: 2, needsTarget: false },
      ];
    case '혁명가':
      return [
        { id: 'detect', label: '감지', cost: 0, needsTarget: false, nonConsuming: true },
        { id: 'control', label: '통제', cost: 5, needsTarget: true },
        { id: 'hidden_trade', label: '은닉거래', cost: 0, needsTarget: true, nonConsuming: true },
        { id: 'mine', label: '채굴', cost: 0, needsTarget: false },
        { id: 'repair_rebel', label: '수리', cost: 2, needsTarget: false },
      ];
    case '반군':
      return [
        { id: 'search', label: '탐색', cost: 5, needsTarget: true },
        { id: 'assassinate', label: '암살', cost: 10, needsTarget: true },
        { id: 'hidden_trade', label: '은닉거래', cost: 0, needsTarget: true, nonConsuming: true },
        { id: 'mine', label: '채굴', cost: 0, needsTarget: false },
        { id: 'repair_rebel', label: '수리', cost: 2, needsTarget: false },
      ];
    case '외계인':
      return [
        { id: 'plunder', label: '약탈', cost: 0, needsTarget: true },
        { id: 'destroy', label: '파괴', cost: 4, needsTarget: false },
      ];
    default:
      return [
        { id: 'mine', label: '채굴', cost: 0, needsTarget: false },
        { id: 'repair_survivor', label: '수리', cost: 1, needsTarget: false },
      ];
  }
}

/* ── 메인 테스트룸 하단 ── */
function TestroomBottom({ game, reload }: { game: Game0bRow; reload: () => void }) {
  const [playerNum, setPlayerNum] = useState<number | null>(null);

  const handleEnd = () => {
    setPlayerNum(null);
  };

  if (game.phase === 'setup') {
    return (
      <div className="bottom-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="bottom-panel-label">대기</div>
        <div className="bottom-panel-body">
          <span style={{ fontSize: 18, color: '#aaa' }}>
            진행자가 역할 분배를 시작할 때까지 대기하세요.
          </span>
        </div>
      </div>
    );
  }

  if (game.phase === 'day') {
    return (
      <div className="bottom-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="bottom-panel-label">대기</div>
        <div className="bottom-panel-body">
          <span style={{ fontSize: 18, color: '#aaa' }}>
            현재 낮 시간입니다. 밤이 될 때까지 대기하세요.
          </span>
        </div>
      </div>
    );
  }

  if (playerNum === null) {
    return <NfcGate game={game} onIdentified={setPlayerNum} />;
  }

  if (game.phase === 'role_reveal') {
    return <RoleRevealPanel game={game} playerNum={playerNum} onDone={handleEnd} />;
  }

  if (game.phase === 'night') {
    return (
      <PlayerActionPanel
        game={game}
        playerNum={playerNum}
        reload={reload}
        onEnd={handleEnd}
      />
    );
  }

  return (
    <div className="bottom-panel" style={{ gridColumn: '1 / -1' }}>
      <div className="bottom-panel-label">대기</div>
      <div className="bottom-panel-body">
        <span style={{ fontSize: 18, color: '#aaa' }}>현재 활동 시간이 아닙니다.</span>
      </div>
    </div>
  );
}
