'use client';

import { useRef, useEffect } from 'react';

/* 뉴럴 파티클 캔버스 — 마우스 반응 + 점등 시 중력 스파이럴 흡수 */
function IntroCanvas({ armed }) {
  const ref = useRef(null);
  const armedRef = useRef(false);
  const burstT = useRef(0);
  useEffect(() => {
    armedRef.current = armed;
    if (armed) burstT.current = performance.now();
  }, [armed]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W, H, raf;
    const resize = () => {
      W = cv.width = window.innerWidth * DPR;
      H = cv.height = window.innerHeight * DPR;
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    const N = window.innerWidth < 700 ? 60 : 110;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18,
      r: Math.random() * 2.2 + 1.5,          /* ↑ 입자 확대 */
    }));
    pts.forEach(p => { p.x *= W; p.y *= H; p.vx *= DPR; p.vy *= DPR; p.r *= DPR; });
    const mouse = { x: -9e3, y: -9e3 };
    const mm = (e) => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; };
    window.addEventListener('mousemove', mm);
    const R = 150 * DPR;
    const BURST_MS = 1500;                    /* ↑ 더 천천히, 드라마틱하게 */
    const loop = (t) => {
      const isBurst = armedRef.current;
      const burst = isBurst ? Math.min((t - burstT.current) / BURST_MS, 1) : 0;
      /* 흡수 중엔 잔상 트레일 (반투명 덮기) */
      if (burst > 0) { ctx.fillStyle = 'rgba(7,8,10,.30)'; ctx.fillRect(0, 0, W, H); }
      else ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * .47;
      for (const p of pts) {
        if (!burst) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R && d2 > .1) {
            const d = Math.sqrt(d2), f = (R - d) / R;
            p.vx += (dx / d) * f * .55; p.vy += (dy / d) * f * .55;
          }
          p.vx *= .955; p.vy *= .955;
        } else {
          /* 중력 스파이럴: 가까울수록 강한 인력(ease-in) + 접선 성분 = 나선 흡입 */
          const dx = cx - p.x, dy = cy - p.y;
          const d = Math.max(Math.hypot(dx, dy), 26 * DPR);
          const g = (burst * burst) * 2600 * DPR / d;
          const swirl = (1 - burst) * 1.15;   /* 초반엔 크게 돌고 점점 직진 */
          p.vx += (dx / d) * g * .016 + (-dy / d) * g * .016 * swirl;
          p.vy += (dy / d) * g * .016 + (dx / d) * g * .016 * swirl;
          p.vx *= .93; p.vy *= .93;
        }
        p.x += p.vx; p.y += p.vy;
        if (!burst) {
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        }
      }
      const MAX = (140 * DPR) ** 2;
      ctx.lineWidth = .85 * DPR;
      const linkFade = 1 - burst * .55;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < MAX) {
            ctx.strokeStyle = `rgba(238,93,12,${(1 - d / MAX) * .34 * linkFade})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        let rr = p.r;
        if (burst > 0) {
          /* 중심에 가까울수록 축소 = 깊이감 (빨려드는 원근) */
          const d = Math.hypot(cx - p.x, cy - p.y);
          rr = p.r * Math.max(.28, Math.min(1, d / (W * .22)));
        }
        ctx.fillStyle = 'rgba(43,214,228,.88)';
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', mm); };
  }, []);
  return <canvas ref={ref} className="intro-canvas" aria-hidden />;
}

export { IntroCanvas };
