'use client';

import { useState } from 'react';
import GameLayout from '../components/GameLayout';
import type { Game0bRow } from '@/lib/game-0b-types';

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

  const playerOptions = Array.from({ length: game.player_count ?? 12 }, (_, i) => i + 1);

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

  const handleAdvance = async (action: string) => {
    setPhaseLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/game/game_0b/advance-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: game.session_id, action }),
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
            {phaseLoading ? '처리 중...' : '다음 라운드 시작'}
          </button>
        </>
      );
    }
    return null;
  };

  if (game.phase === 'night' || game.phase === 'setup') {
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
              {game.phase === 'setup' && '게임 대기 중 — 플레이어 역할 확인 후 시작하세요.'}
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
              max={99}
              value={coreAmount}
              onChange={(e) => setCoreAmount(Math.max(1, Number(e.target.value)))}
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
