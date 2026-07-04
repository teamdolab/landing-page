'use client';

import { useRef, useState } from 'react';
import { IntroCanvas } from './IntroCanvas';
import './intro-v12-vars.css';
import './intro-v12.css';

export function IntroScreen({ onComplete }) {
  const [armed, setArmed] = useState(false);
  const [powered, setPowered] = useState(false);
  const introCenterRef = useRef(null);
  const powerOn = () => {
    if (armed) return;
    if (introCenterRef.current) introCenterRef.current.style.transform = '';  // 패럴랙스 해제 → 줌인 애니메이션에 양보
    setArmed(true);
    setTimeout(() => {
      setPowered(true);
      onComplete?.();
    }, 1900);
  };

  return (
    <div className="rg">
      {/* ① 인트로 — 뉴럴 부팅 */}
      <div
        className={`intro ${armed ? 'armed' : ''} ${powered ? 'gone' : ''}`}
        onMouseMove={(e) => {
          if (armed) return;  // 점등 후엔 줌인 연출 우선
          if (introCenterRef.current) {
            const x = (e.clientX / window.innerWidth - 0.5);
            const y = (e.clientY / window.innerHeight - 0.5);
            introCenterRef.current.style.transform = `translate(${x * 16}px, ${y * 12}px)`;
          }
        }}
      >
        <IntroCanvas armed={armed} />
        <span className="ring r1" aria-hidden />
        <span className="ring r2" aria-hidden />
        <span className="flash" aria-hidden />

        <div className="intro-corner tl mono">DO:NEON PROJECT<br />SEASON 0</div>
        <div className="intro-corner tr mono">LAB STATUS<br /><i className="dot" />{armed ? 'ONLINE' : 'STANDBY'}</div>
        <div className="intro-corner bl mono">SEOUL, KR<br />37.56°N 126.97°E</div>
        <div className="intro-corner br mono">NEURAL FIELD — ACTIVE<br />MOVE CURSOR TO DISTURB</div>

        <div className="intro-center" ref={introCenterRef}>
          <div className="intro-eyebrow mono">소셜전략게임 연구소</div>
          <div className="intro-word">DO:<em>LAB</em></div>
          <button type="button" className="sym-btn" aria-label="전원 ON — DO:LAB 입장" onClick={powerOn}>
            <svg className="hex-ring" viewBox="0 0 100 100" aria-hidden>
              <polygon points="50,3 94,26.5 94,73.5 50,97 6,73.5 6,26.5" />
            </svg>
            <span className="hex-glow" aria-hidden />
            <img src="/brand/dolab-symbol.png" alt="" />
          </button>
          <div className="intro-hint mono">{armed ? 'POWERING ON…' : 'PRESS TO POWER ON'}</div>
        </div>

        <div className="intro-boot mono" aria-hidden>
          <span>&gt; NEURAL LINK ······· <em>READY</em></span>
          <span>&gt; SIMULATION DECK ··· <em>READY</em></span>
          <span>&gt; SUBJECT RECRUIT ··· <em>OPEN</em></span>
        </div>
      </div>
    </div>
  );
}
