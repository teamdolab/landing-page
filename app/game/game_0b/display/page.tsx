'use client';

import GameLayout, { shipStatus } from '../components/GameLayout';
import type { Game0bRow } from '@/lib/game-0b-types';

const ACTION_LABEL: Record<string, string> = {
  mine: '채굴',
  repair: '수리',
  repair_survivor: '수리',
  repair_rebel: '수리',
  search: '탐색',
  control: '통제',
  detect: '감지',
  jamming: '교란',
  assassinate: '암살',
  plunder: '약탈',
  destroy: '파괴',
  hidden_trade: '은닉거래',
  skip: '행동 없음',
  none: '행동 없음',
  commander_assassinated: '사령관이 암살당했습니다.',
  revolutionary_emerged: '혁명가가 등장했습니다.',
};

export default function Game0bDisplayPage() {
  return (
    <GameLayout role="display">
      {(game: Game0bRow) => <DisplayBottom game={game} />}
    </GameLayout>
  );
}

function DisplayBottom({ game }: { game: Game0bRow }) {
  const status = shipStatus(game.ship_hull);
  const detectedActions = Array.isArray(game.detected_actions) ? game.detected_actions : [];
  const transferLog: number[] = Array.isArray(game.public_transfer_log) ? game.public_transfer_log as number[] : [];

  if (game.phase === 'setup' || game.phase === 'role_reveal') {
    return (
      <>
        <div className="bottom-panel">
          <div className="bottom-panel-label">게임 준비</div>
          <div className="bottom-panel-body">
            <span style={{ fontSize: 16, color: '#aaa' }}>
              {game.phase === 'setup' ? '게임 생성됨 · 역할 분배 대기' : '역할 확인 진행 중'}
            </span>
          </div>
        </div>

        <div className="bottom-panel">
          <div className="bottom-panel-label">수송선 상태</div>
          <div className="bottom-panel-body">
            <div className={`ship-status-badge ${status.className}`}>{status.label}</div>
          </div>
        </div>

        <div className="bottom-panel">
          <div className="bottom-panel-label">참가 인원</div>
          <div className="bottom-panel-body">
            <span style={{ fontSize: 28, fontWeight: 800, color: '#5a32b8' }}>
              {game.player_count ?? 12}명
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 좌측: 감지된 액션 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">감지된 액션</div>
        <div className="bottom-panel-body" style={{ justifyContent: 'flex-start', alignItems: 'stretch' }}>
          {detectedActions.length > 0
            ? detectedActions.map((a, i) => {
                const item = a as Record<string, unknown>;
                const actionName = ACTION_LABEL[item.action as string] ?? (item.action as string);
                const hideTarget = item.action === 'plunder';
                return (
                  <div key={i} className="detected-action-item">
                    {actionName}
                    {!hideTarget && item.target != null ? ` → ${item.target}번` : ''}
                  </div>
                );
              })
            : <span className="empty-text">감지 결과 없음</span>}
        </div>
      </div>

      {/* 중앙: 수송선 상태 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">수송선 상태</div>
        <div className="bottom-panel-body">
          <div className={`ship-status-badge ${status.className}`}>{status.label}</div>
        </div>
      </div>

      {/* 우측: 코어 교환 알림 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">코어 교환</div>
        <div className="bottom-panel-body" style={{ justifyContent: 'flex-start', alignItems: 'stretch' }}>
          {transferLog.length > 0
            ? transferLog.map((num, i) => (
                <div key={i} className="transfer-log-item">
                  PLAYER {num}
                </div>
              ))
            : <span className="empty-text">교환 기록 없음</span>}
        </div>
      </div>
    </>
  );
}
