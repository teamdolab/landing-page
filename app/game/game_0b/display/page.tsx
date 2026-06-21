'use client';

import type { CSSProperties } from 'react';
import { Anchor, Siren, Skull } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import GameLayout, { shipStatus } from '../components/GameLayout';
import {
  ACTION_LABEL,
  clampShipHull,
  getPlayerRoleCore,
  shipHullDisplayStatus,
  type Game0bRow,
} from '@/lib/game-0b-types';
import { ACTION_CONFIG } from '@/lib/game-0b-action-config';
import { lifeboatSeatsFromRow } from '@/lib/game-0b-result';

export default function Game0bDisplayPage() {
  return (
    <GameLayout role="display" cockpit>
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
    <div
      className="ss-result-reveal-root"
      style={{ flexDirection: 'row', alignItems: 'stretch', gap: 16 } as CSSProperties}
    >
      <section
        className="final-result-section ss-final-result-section"
        style={{ '--bottom-content-width': `${bottomWidth}px`, flex: 1, minWidth: 0 } as CSSProperties}
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

      <ResultFeedbackQr sessionId={game.session_id ?? ''} />
    </div>
  );
}

/** 최종 결과 송출 시 우측에 표시되는 딥 피드백 QR (host의 QR과 동일 주소/만료 규칙). */
function ResultFeedbackQr({ sessionId }: { sessionId: string }) {
  if (!sessionId) return null;

  // 오늘 자정 만료 (host/page.tsx와 동일 로직)
  const todayMidnightUnix = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 0);
    return Math.floor(d.getTime() / 1000);
  })();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `${origin}/feedback/deep?session=${encodeURIComponent(sessionId)}&expires=${todayMidnightUnix}`;

  return (
    <aside
      style={{
        flex: '0 0 auto',
        width: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '18px 14px',
        borderLeft: '1px dashed rgba(74, 61, 107, 0.25)',
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 800, color: '#1c1538', textAlign: 'center', lineHeight: 1.35 }}>
        게임 어땠나요?
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#4a3d6b', textAlign: 'center', lineHeight: 1.4 }}>
        QR을 스캔하고
        <br />
        피드백을 남겨주세요
      </span>
      <div style={{ background: '#fff', padding: 10, borderRadius: 10, boxShadow: '0 2px 12px rgba(28,21,56,0.18)' }}>
        <QRCodeSVG value={qrUrl} size={150} bgColor="#ffffff" fgColor="#1a0a3c" />
      </div>
    </aside>
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

  // ── 콕핏 데크: 계기판 스크린 3개 (목업 transport-display-cockpit.jsx 구조) ──
  // 선체는 숫자/게이지 없이 안전·위험·파괴 3단계 상태만 노출 (송출 규칙)
  const hullStatus = shipHullDisplayStatus(game.ship_hull);
  const { label: hullLabel, Icon: HullIcon } = HULL_META[hullStatus];

  return (
    <>
      {/* 좌 스크린: 감지된 액션 */}
      <div className="scope">
        <div className="scope-label mono"><span className="scope-tick" />감지된 액션</div>
        {detectedActions.length > 0 ? (
          <div className="chips">
            {detectedActions.map((a, i) => {
              const item = a as Record<string, unknown>;
              const actionId = item.action as string;
              const actionName = ACTION_LABEL[actionId] ?? actionId;
              const cfg = ACTION_CONFIG[actionId];
              const Icon = cfg?.icon;
              return (
                <div key={i} className="chip">
                  {Icon && <Icon size={26} strokeWidth={1.8} />}
                  <b>{actionName}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="log-empty">감지 결과 없음</span>
        )}
      </div>

      {/* 중앙 계기: 수송선 선체 — 게이지/숫자 없이 안전·위험·파괴 상태만 크게 표시 */}
      <div className="scope">
        <div className="scope-label mono"><span className="scope-tick" />수송선 선체</div>
        <div className={`hull-status-only ${hullStatus}`}>
          <div className="hull-status-icon">
            <HullIcon size={hullStatus === 'danger' ? 100 : 84} strokeWidth={1.7} />
          </div>
          <div className="hull-status-word">{hullLabel}</div>
        </div>
      </div>

      {/* 우 스크린: 코어 교환 (현행 데이터 그대로 — PLAYER n) */}
      <div className="scope">
        <div className="scope-label mono"><span className="scope-tick" />코어 교환</div>
        {transferLog.length > 0 ? (
          <div className="log mono">
            {transferLog.map((num, i) => (
              <div key={i} className="log-row">
                <span className="log-pid">PLAYER {num}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="log-empty">아직 교환 기록이 없습니다</div>
        )}
      </div>
    </>
  );
}

const HULL_META = {
  ok: { label: '안전', Icon: Anchor },
  warn: { label: '위험', Icon: Siren },
  danger: { label: '파괴', Icon: Skull },
} as const;
