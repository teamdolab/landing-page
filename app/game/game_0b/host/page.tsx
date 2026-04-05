'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import GameLayout from '../components/GameLayout';
import { getPlayerRoleCore, type Game0bRow } from '@/lib/game-0b-types';
import { countLifeboatSlots } from '@/lib/game-0b-result';

export default function Game0bHostPage() {
  return (
    <GameLayout role="host">
      {(game: Game0bRow, reload: () => void) => <HostBottom game={game} reload={reload} />}
    </GameLayout>
  );
}

function HostBottom({ game, reload }: { game: Game0bRow; reload: () => void }) {
  const [fromPlayer, setFromPlayer] = useState<number>(1);
  const [toPlayer, setToPlayer] = useState<number>(2);
  const [coreAmount, setCoreAmount] = useState<number>(1);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [lifeboatPick, setLifeboatPick] = useState<Set<number>>(() => new Set());

  const playerOptions = Array.from({ length: game.player_count ?? 12 }, (_, i) => i + 1);

  if (game.phase === 'result_reveal' && game.status === '완료') {
    return (
      <HostResultRevealBlock
        game={game}
        reload={reload}
        lifeboatPick={lifeboatPick}
        setLifeboatPick={setLifeboatPick}
        msg={msg}
        setMsg={setMsg}
        phaseLoading={phaseLoading}
        setPhaseLoading={setPhaseLoading}
      />
    );
  }

  const handleTransfer = async () => {
    if (fromPlayer === toPlayer) {
      setMsg('보내는/받는 플레이어가 같습니다.');
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0b/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: game.session_id,
          from_player: fromPlayer,
          to_player: toPlayer,
          amount: coreAmount,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error || '실패');
      } else {
        setMsg('코어 전송 완료');
        reload();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setSending(false);
    }
  };

  const handleAdvance = async (action: string, extra?: Record<string, unknown>) => {
    setPhaseLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0b/advance-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: game.session_id, action, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error || '전환 실패');
      } else {
        reload();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setPhaseLoading(false);
    }
  };

  const phaseButton = () => {
    if (game.status === '완료') {
      return <span style={{ color: '#888', fontWeight: 600, fontSize: 15 }}>게임 종료됨</span>;
    }
    if (game.phase === 'setup') {
      return (
        <button
          type="button"
          className="host-confirm-btn"
          disabled={phaseLoading}
          onClick={() => handleAdvance('distribute_roles')}
        >
          {phaseLoading ? '처리 중...' : '역할 분배'}
        </button>
      );
    }
    if (game.phase === 'role_reveal') {
      return (
        <button
          type="button"
          className="host-confirm-btn"
          disabled={phaseLoading}
          onClick={() => handleAdvance('start_round')}
        >
          {phaseLoading ? '처리 중...' : '1라운드 시작'}
        </button>
      );
    }
    if (game.phase === 'day') {
      return (
        <button
          type="button"
          className="host-confirm-btn"
          disabled={phaseLoading}
          onClick={() => handleAdvance('start_night')}
        >
          {phaseLoading ? '처리 중...' : '밤 시작'}
        </button>
      );
    }
    if (game.phase === 'night') {
      const endLabel =
        game.current_round >= 5 ? '게임 종료 및 결과 처리' : '다음 라운드 시작';
      return (
        <>
          <span style={{ fontSize: 13, color: '#8a7db0', marginBottom: 4 }}>
            액션 완료: {game.night_action_count ?? 0} / {game.player_count ?? 12}
          </span>
          <button
            type="button"
            className="host-confirm-btn"
            disabled={phaseLoading}
            onClick={() => handleAdvance('start_round')}
          >
            {phaseLoading ? '처리 중...' : endLabel}
          </button>
        </>
      );
    }
    return null;
  };

  if (game.phase === 'night' || game.phase === 'setup' || game.phase === 'role_reveal') {
    return (
      <>
        <div className="bottom-panel">
          <div className="bottom-panel-label">게임 진행</div>
          <div className="bottom-panel-body">
            {phaseButton()}
            {msg && (
              <span style={{ fontSize: 13, color: '#c62828', fontWeight: 600 }}>{msg}</span>
            )}
          </div>
        </div>

        <div className="bottom-panel">
          <div className="bottom-panel-label">현재 상태</div>
          <div className="bottom-panel-body">
            <span style={{ fontSize: 14, color: '#aaa' }}>
              {game.phase === 'setup' && '게임 생성됨 — 역할 분배를 시작하세요.'}
              {game.phase === 'role_reveal' && '역할 확인 중 — 플레이어들이 테스트룸에서 카드를 태그하고 있습니다.'}
              {game.phase === 'night' && `${game.current_round}라운드 밤 진행 중`}
            </span>
          </div>
        </div>

        <div className="bottom-panel">
          <div className="bottom-panel-label">선 플레이어</div>
          <div className="bottom-panel-body">
            <span style={{ fontSize: 20, fontWeight: 700, color: '#5a32b8' }}>
              {game.first_player_number ?? '-'}번
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 좌측: 보내는 플레이어 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">보내는 플레이어</div>
        <div className="bottom-panel-body">
          <div className="host-input-group">
            <select
              className="host-select"
              value={fromPlayer}
              onChange={(e) => setFromPlayer(Number(e.target.value))}
            >
              {playerOptions.map((n) => (
                <option key={n} value={n}>{n}번</option>
              ))}
            </select>
            <span style={{ fontSize: 14, color: '#5a32b8', fontWeight: 700 }}>
              보유 코어: {getPlayerRoleCore(game, fromPlayer).core}
            </span>
            {Array.isArray(game.public_transfer_log) && game.public_transfer_log.includes(fromPlayer) && (
              <span style={{ fontSize: 12, color: '#c62828', fontWeight: 700 }}>
                이번 라운드 교환 완료
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 중앙: 받는 플레이어 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">받는 플레이어</div>
        <div className="bottom-panel-body">
          <div className="host-input-group">
            <select
              className="host-select"
              value={toPlayer}
              onChange={(e) => setToPlayer(Number(e.target.value))}
            >
              {playerOptions.map((n) => (
                <option key={n} value={n}>{n}번</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 우측: 코어 개수 + 확인 + 페이즈 전환 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">코어 교환 / 진행</div>
        <div className="bottom-panel-body">
          <div className="host-input-group">
            <label>코어 개수</label>
            <input
              type="number"
              className="host-number-input"
              min={1}
              max={3}
              value={coreAmount}
              onChange={(e) => setCoreAmount(Math.min(3, Math.max(1, Number(e.target.value))))}
            />
            <button
              type="button"
              className="host-confirm-btn"
              disabled={sending}
              onClick={handleTransfer}
            >
              {sending ? '처리 중...' : '교환 확인'}
            </button>
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
              {phaseButton()}
            </div>
            {msg && (
              <span style={{ fontSize: 13, color: '#5a32b8', fontWeight: 600, textAlign: 'center' }}>
                {msg}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function HostResultRevealBlock({
  game,
  reload,
  lifeboatPick,
  setLifeboatPick,
  msg,
  setMsg,
  phaseLoading,
  setPhaseLoading,
}: {
  game: Game0bRow;
  reload: () => void;
  lifeboatPick: Set<number>;
  setLifeboatPick: Dispatch<SetStateAction<Set<number>>>;
  msg: string | null;
  setMsg: (s: string | null) => void;
  phaseLoading: boolean;
  setPhaseLoading: (v: boolean) => void;
}) {
  const slots = countLifeboatSlots(game);
  const locked = game.result_locked;
  const hull = game.ship_hull;
  const lifeboatDone = game.lifeboat_seat_1 != null;
  const needLifeboat = hull > 50;

  const handleAdvance = async (action: string, extra?: Record<string, unknown>) => {
    setPhaseLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0b/advance-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: game.session_id, action, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error || '실패');
      } else {
        setLifeboatPick(new Set());
        reload();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setPhaseLoading(false);
    }
  };

  const toggleSeat = (n: number) => {
    setLifeboatPick((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < slots) next.add(n);
      return next;
    });
  };

  let body: React.ReactNode;
  if (!locked) {
    body = (
      <button
        type="button"
        className="host-confirm-btn"
        disabled={phaseLoading}
        onClick={() => handleAdvance('reveal_gauge')}
      >
        {phaseLoading ? '처리 중...' : '게이지 공개'}
      </button>
    );
  } else if (needLifeboat && !lifeboatDone) {
    body = (
      <div className="host-lifeboat-block">
        <p className="host-lifeboat-hint">
          탑승 인원 {slots}명 선택 (현재 진영 인원만 선택 가능)
        </p>
        <div className="host-lifeboat-checks">
          {Array.from({ length: game.player_count }, (_, i) => i + 1).map((n) => {
            const { role } = getPlayerRoleCore(game, n);
            const checked = lifeboatPick.has(n);
            return (
              <label key={n} className="host-lifeboat-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSeat(n)}
                />
                <span>
                  {n}번 {role ? `· ${role}` : ''}
                </span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className="host-confirm-btn"
          disabled={phaseLoading || lifeboatPick.size !== slots}
          onClick={() => handleAdvance('confirm_lifeboat', { seats: [...lifeboatPick].sort((a, b) => a - b) })}
        >
          {phaseLoading ? '처리 중...' : '탑승 확정'}
        </button>
      </div>
    );
  } else {
    body = (
      <span style={{ fontSize: 15, color: '#4a3d6b', fontWeight: 700, textAlign: 'center' }}>
        최종 결과는 송출 화면을 확인하세요.
      </span>
    );
  }

  return (
    <div className="host-result-reveal-wrap">
      <div className="bottom-panel host-result-reveal-panel">
        <div className="bottom-panel-label">결과 공개</div>
        <div className="bottom-panel-body host-result-reveal-body">
          {body}
          {msg && (
            <span style={{ fontSize: 13, color: '#c62828', fontWeight: 600 }}>{msg}</span>
          )}
        </div>
      </div>
      <div className="bottom-panel">
        <div className="bottom-panel-label">수송선 게이지</div>
        <div className="bottom-panel-body">
          <span style={{ fontSize: 28, fontWeight: 800, color: '#5a32b8' }}>{hull}%</span>
        </div>
      </div>
      <div className="bottom-panel">
        <div className="bottom-panel-label">탑승</div>
        <div className="bottom-panel-body">
          <span style={{ fontSize: 14, color: '#666' }}>
            {!needLifeboat && '위험/파괴 — 외계인 승리 (탑승 선택 없음)'}
            {needLifeboat && !locked && '게이지 공개 후 탑승 인원을 선택합니다.'}
            {needLifeboat && locked && !lifeboatDone && `${slots}명 선택 후 확정하세요.`}
            {needLifeboat && lifeboatDone && '탑승 확정 완료'}
          </span>
        </div>
      </div>
    </div>
  );
}
