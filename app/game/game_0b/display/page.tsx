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
                return (
                  <div key={i} className="detected-action-item">
                    {actionName}
                    {item.target != null ? ` → ${item.target}번` : ''}
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
        <div className="bottom-panel-body">
          {game.last_public_transfer_from != null ? (
            <div className="transfer-log-item">
              {game.last_public_transfer_from}번 플레이어가 누군가에게 코어를 보냈습니다.
            </div>
          ) : (
            <span className="empty-text">교환 기록 없음</span>
          )}
        </div>
      </div>
    </>
  );
}
