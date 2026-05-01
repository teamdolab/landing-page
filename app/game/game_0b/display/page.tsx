'use client';

import type { CSSProperties } from 'react';
import { Anchor, Siren, Skull } from 'lucide-react';
import GameLayout, { shipStatus } from '../components/GameLayout';
import {
  ACTION_LABEL,
  clampShipHull,
  getPlayerRoleCore,
  type Game0bRow,
} from '@/lib/game-0b-types';
import { ACTION_CONFIG } from '@/lib/game-0b-action-config';
import { ActionCard } from '../components/ActionCard';
import { lifeboatSeatsFromRow } from '@/lib/game-0b-result';

export default function Game0bDisplayPage() {
  return (
    <GameLayout role="display">
      {(game: Game0bRow) => <DisplayBottom game={game} />}
    </GameLayout>
  );
}

/** 최종 단상에 올릴 승리자 번호. 외계인 승(위험/파괴 또는 탑승에 외계인): 외계인만. 인간 측 승(탑승 확정): 탑승자 전원만. */
function podiumSections(game: Game0bRow): { label: string; nums: number[] }[] {
  const hull = clampShipHull(game.ship_hull);
  if (hull <= 50) {
    const nums: number[] = [];
    for (let i = 1; i <= game.player_count; i++) {
      if (getPlayerRoleCore(game, i).role === '외계인') nums.push(i);
    }
    return [{ label: '승리 · 외계인 진영', nums }];
  }
  const seats = lifeboatSeatsFromRow(game);
  if (seats.length === 0) return [];
  const numsSorted = [...seats].sort((a, b) => a - b);
  const hasAlien = seats.some((s) => getPlayerRoleCore(game, s).role === '외계인');
  if (hasAlien) {
    return [
      {
        label: '승리 · 외계인 진영',
        nums: numsSorted.filter((s) => getPlayerRoleCore(game, s).role === '외계인'),
      },
    ];
  }
  // 인간 진영 승리: 탑승자만 승리(나머지는 패배). 1·2등 서사는 상단 info_text에만 반영.
  return [{ label: '승리 · 탑승자', nums: numsSorted }];
}

function getWinnerPlayerNumbers(game: Game0bRow): Set<number> {
  const hull = clampShipHull(game.ship_hull);
  if (hull <= 50) {
    const s = new Set<number>();
    for (let i = 1; i <= game.player_count; i++) {
      if (getPlayerRoleCore(game, i).role === '외계인') s.add(i);
    }
    return s;
  }
  const seats = lifeboatSeatsFromRow(game);
  const hasAlien = seats.some((s) => getPlayerRoleCore(game, s).role === '외계인');
  if (hasAlien) {
    return new Set(seats.filter((s) => getPlayerRoleCore(game, s).role === '외계인'));
  }
  return new Set(seats);
}

function ResultRevealDisplay({ game }: { game: Game0bRow }) {
  const locked = game.result_locked;
  const hull = clampShipHull(game.ship_hull);
  const lifeboatDone = game.lifeboat_seat_1 != null;
  const needLifeboat = hull > 50;
  const showFinal = locked && (!needLifeboat || lifeboatDone);

  if (!locked) {
    return (
      <div className="ss-result-reveal-root">
        <div className="final-result-loading ss-final-result-loading">
          <span className="final-result-loading-text">결과 집계 중...</span>
          <span className="final-result-dots">
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </span>
        </div>
      </div>
    );
  }

  if (!showFinal) {
    return (
      <div className="ss-result-reveal-root ss-result-reveal-wait">
        <p className="ss-result-reveal-main">수송선 게이지: {hull}%</p>
        <p className="ss-result-reveal-sub">탑승 인원 선정 중...</p>
      </div>
    );
  }

  const sections = podiumSections(game);
  const maxRow = Math.max(1, ...sections.map((s) => s.nums.length));
  const bottomWidth = maxRow * 76 + Math.max(0, maxRow - 1) * 16;
  const winnerNums = getWinnerPlayerNumbers(game);
  const allPlayers = Array.from({ length: game.player_count }, (_, i) => {
    const n = i + 1;
    const { role } = getPlayerRoleCore(game, n);
    return { num: n, role };
  });

  return (
    <div className="ss-result-reveal-root">
      <section
        className="final-result-section ss-final-result-section"
        style={{ '--bottom-content-width': `${bottomWidth}px` } as CSSProperties}
      >
        <div className="ss-result-podium-wrap">
          {sections.map((sec) => (
            <div key={sec.label} className="ss-result-podium-block">
              <div className="ss-result-podium-label">{sec.label}</div>
              <div className="final-result-podium ss-result-podium">
                <div className="final-result-podium-inner">
                  {sec.nums.map((num) => {
                    const { role } = getPlayerRoleCore(game, num);
                    return (
                      <div key={num} className="final-result-player final-result-winner">
                        <div className="final-winner-crown">👑</div>
                        <div className="avatar-wrapper">
                          <div className="node-box">
                            <span className="player-num">{num}</span>
                          </div>
                        </div>
                        <div className="score-box ss-result-role-box">{role ?? '—'}</div>
                        <div className="final-badge final-badge-winner">승리</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="ss-result-all-label">전원 역할 공개</div>
        <div className="final-result-bottom ss-final-result-bottom">
          {allPlayers.map((p) => {
            const won = winnerNums.has(p.num);
            return (
              <div
                key={p.num}
                className={`final-result-player ${won ? 'ss-result-row-winner' : 'ss-result-row-loser'}`}
              >
                <div className="avatar-wrapper">
                  <div className="node-box">
                    <span className="player-num">{p.num}</span>
                  </div>
                </div>
                <div className="score-box ss-result-role-box">{p.role ?? '—'}</div>
                <div className={`ss-result-outcome-badge ${won ? 'ss-result-outcome-win' : 'ss-result-outcome-lose'}`}>
                  {won ? '승리' : '패배'}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DisplayBottom({ game }: { game: Game0bRow }) {
  if (game.phase === 'result_reveal') {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <ResultRevealDisplay game={game} />
      </div>
    );
  }

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
        <div className="bottom-panel-body action-icon-grid">
          {detectedActions.length > 0
            ? detectedActions.map((a, i) => {
                const item = a as Record<string, unknown>;
                const actionId = item.action as string;
                const actionName = ACTION_LABEL[actionId] ?? actionId;
                const cfg = ACTION_CONFIG[actionId];
                if (!cfg) return <span key={i} className="empty-text">{actionName}</span>;
                return (
                  <ActionCard
                    key={i}
                    icon={cfg.icon}
                    label={actionName}
                    color={cfg.color}
                    size="sm"
                  />
                );
              })
            : <span className="empty-text">감지 결과 없음</span>}
        </div>
      </div>

      {/* 중앙: 수송선 상태 */}
      <div className="bottom-panel">
        <div className="bottom-panel-label">수송선 상태</div>
        <div className="bottom-panel-body" style={{ gap: 8 }}>
          <ShipStatusCards currentStatus={status.className} />
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

const SHIP_STATUS_CARDS = [
  {
    key: 'ship-safe',
    label: '안전',
    icon: Anchor,
    color: '#22C55E',
    activeGlow: '0 0 18px #22C55E99, 0 0 40px #22C55E44',
    pulseClass: undefined,
  },
  {
    key: 'ship-danger',
    label: '위험',
    icon: Siren,
    color: '#F59E0B',
    activeGlow: '0 0 18px #F59E0B99, 0 0 40px #F59E0B44',
    pulseClass: 'ship-status-card-pulse-danger',
  },
  {
    key: 'ship-destroy',
    label: '파괴',
    icon: Skull,
    color: '#EF4444',
    activeGlow: '0 0 18px #EF444499, 0 0 40px #EF444444',
    pulseClass: 'ship-status-card-pulse-destroy',
  },
] as const;

function ShipStatusCards({ currentStatus }: { currentStatus: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      {SHIP_STATUS_CARDS.map(({ key, label, icon: Icon, color, activeGlow, pulseClass }) => {
        const isActive = currentStatus === key;
        return (
          <div
            key={key}
            className={isActive && pulseClass ? pulseClass : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 72,
              borderRadius: 8,
              overflow: 'hidden',
              border: `2px solid ${isActive ? color : '#333'}`,
              boxShadow: isActive ? activeGlow : 'none',
              opacity: isActive ? 1 : 0.25,
              transition: 'opacity 0.4s, border-color 0.4s, box-shadow 0.4s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 10px 10px',
                background: isActive
                  ? `linear-gradient(160deg, ${color}2e 0%, ${color}0d 100%)`
                  : '#0a0a0a',
                width: '100%',
              }}
            >
              <Icon size={40} color={isActive ? color : '#555'} strokeWidth={1.6} />
            </div>
            <div
              style={{
                background: '#111',
                borderTop: `1px solid ${isActive ? color + '55' : '#222'}`,
                padding: '5px 4px 6px',
                textAlign: 'center',
                width: '100%',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: isActive ? color : '#444',
                  letterSpacing: '0.3px',
                }}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
