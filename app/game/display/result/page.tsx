'use client';

import Link from 'next/link';
import './result-styles.css';

/** 송출용 결과 화면만 미리보기 (목업 데이터) */
export default function ResultPreviewPage() {
  const finalWinners = [3, 7]; // 공동 우승 2명 → 하단은 3rd부터
  const rankedPlayers = [
    { player_number: 3, total_score: 320 },
    { player_number: 7, total_score: 320 },
    { player_number: 1, total_score: 280 },
    { player_number: 5, total_score: 260 },
    { player_number: 9, total_score: 240 },
    { player_number: 2, total_score: 220 },
    { player_number: 4, total_score: 200 },
    { player_number: 6, total_score: 180 },
    { player_number: 8, total_score: 160 },
    { player_number: 10, total_score: 140 },
    { player_number: 11, total_score: 120 },
    { player_number: 12, total_score: 100 },
  ];

  return (
    <div className="result-preview-root">
      <div className="result-preview-back">
        <Link href="/game/display">← 송출 화면으로</Link>
      </div>
      <div className="game-display-root result-preview-wrap">
        <div className="scanlines" aria-hidden />
        <div className="hud-corner hud-tl" aria-hidden />
        <div className="hud-corner hud-tr" aria-hidden />
        <div className="hud-corner hud-bl" aria-hidden />
        <div className="hud-corner hud-br" aria-hidden />

        <header className="display-header">
          <div className="brand-box">
            <span className="brand-main">DO:LAB</span>
            <span className="brand-sub">NEON PROJECT</span>
          </div>
          <div className="title-frame">
            <h1 className="game-title">대선 포커</h1>
          </div>
          <div className="round-box">게임 종료</div>
        </header>

        <main className="display-main">
          <section className="info-section">
            <div className="phase-container">
              <div className="phase-current">게임 종료</div>
            </div>
            <div className="timer-wrapper">
              <div className="timer-container">
                <div className="timer-value timer-end">게임 종료</div>
              </div>
            </div>
            <div className="ranking-container">
              <div className="ranking-header">HAND RANKINGS</div>
              <ul className="ranking-list">
                <li className="rank-item s-tier">스트레이트 플러쉬</li>
                <li className="rank-item s-tier">포카드</li>
                <li className="rank-item a-tier">플러쉬</li>
                <li className="rank-item a-tier">풀하우스</li>
                <li className="rank-item b-tier">스트레이트</li>
                <li className="rank-item b-tier">트리플</li>
                <li className="rank-item c-tier">투페어</li>
                <li className="rank-item c-tier">원페어</li>
              </ul>
            </div>
          </section>

          <section
            className="final-result-section"
            style={{ '--bottom-content-width': `${(12 - 2) * 76 + 9 * 16}px` } as React.CSSProperties}
          >
            {/* 단상: 우승자들 */}
            <div className="final-result-podium">
              <div className="final-result-podium-inner">
                {finalWinners.map((num) => {
                  const p = rankedPlayers.find((x) => x.player_number === num);
                  const score = p?.total_score ?? 0;
                  return (
                    <div key={num} className="final-result-player final-result-winner">
                      <div className="final-winner-crown">👑</div>
                      <div className="avatar-wrapper">
                        <div className="node-box">
                          <span className="player-num">{num}</span>
                        </div>
                      </div>
                      <div className="score-box">{score}</div>
                      <div className="final-badge final-badge-winner">WINNER</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 하단: 우승자 제외, 등수는 3rd부터 (우승 2명) */}
            <div className="final-result-bottom">
              {rankedPlayers
                .filter((p) => !finalWinners.includes(p.player_number))
                .map((p, idx) => {
                  const rank = finalWinners.length + 1 + idx;
                  const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
                  return (
                    <div key={p.player_number} className="final-result-player">
                      <div className="avatar-wrapper">
                        <div className="node-box">
                          <span className="player-num">{p.player_number}</span>
                        </div>
                      </div>
                      <div className="score-box">{p.total_score}</div>
                      <div className="final-badge final-badge-rank">{rankLabel}</div>
                    </div>
                  );
                })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
