'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export type IntroPhase = 'idle' | 'converge' | 'flash' | 'zoom';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
};

const PARTICLE_COUNT = 72;
const CONNECTION_DIST = 110;

function createParticles(w: number, h: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const x = Math.random() * w;
    const y = Math.random() * h;
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      baseX: x,
      baseY: y,
    };
  });
}

type IntroCanvasProps = {
  phase: IntroPhase;
  onPowerClick: () => void;
  disabled?: boolean;
};

export function IntroCanvas({ phase, onPowerClick, disabled }: IntroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<IntroPhase>(phase);
  const progressRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase === 'converge') progressRef.current = 0;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(rect.width, rect.height);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const cx = () => canvas.getBoundingClientRect().width / 2;
    const cy = () => canvas.getBoundingClientRect().height / 2;

    const tick = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const centerX = cx();
      const centerY = cy();
      const currentPhase = phaseRef.current;

      if (currentPhase === 'converge') {
        progressRef.current = Math.min(1, progressRef.current + 0.018);
      }

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      for (const p of particles) {
        if (currentPhase === 'idle') {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        } else if (currentPhase === 'converge' || currentPhase === 'flash') {
          const t = progressRef.current;
          p.x += (centerX - p.x) * (0.04 + t * 0.06);
          p.y += (centerY - p.y) * (0.04 + t * 0.06);
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * (currentPhase === 'idle' ? 0.35 : 0.55);
            ctx.strokeStyle = `rgba(238, 93, 12, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle =
          currentPhase === 'flash'
            ? 'rgba(238, 93, 12, 0.95)'
            : 'rgba(238, 93, 12, 0.75)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentPhase === 'idle' ? 1.6 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const zoomScale = phase === 'zoom' ? 8 : 1;
  const zoomOpacity = phase === 'zoom' ? 0 : 1;

  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-[70vh] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden
      />

      {/* 헥사곤 링 SVG */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{
          scale: phase === 'converge' ? 0.85 : phase === 'zoom' ? 2.5 : 1,
          opacity: phase === 'flash' ? 0.3 : phase === 'zoom' ? 0 : 0.7,
        }}
        transition={{ duration: phase === 'zoom' ? 0.6 : 1.2, ease: [0.55, 0, 0.7, 0.9] }}
      >
        <svg width="320" height="320" viewBox="0 0 320 320" fill="none" aria-hidden>
          <polygon
            points="160,20 277,88 277,232 160,300 43,232 43,88"
            stroke="rgba(238,93,12,0.35)"
            strokeWidth="1"
            fill="none"
          />
          <polygon
            points="160,50 247,100 247,220 160,270 73,220 73,100"
            stroke="rgba(43,214,228,0.25)"
            strokeWidth="1"
            fill="none"
          />
          <polygon
            points="160,80 217,112 217,208 160,240 103,208 103,112"
            stroke="rgba(238,93,12,0.5)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </motion.div>

      {phase === 'flash' && (
        <div className="absolute inset-0 bg-signal/40 animate-intro-flash pointer-events-none" />
      )}

      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-4"
        animate={{ scale: zoomScale, opacity: zoomOpacity }}
        transition={{ duration: 0.6, ease: [0.55, 0, 0.7, 0.9] }}
      >
        <p className="font-display text-xl md:text-3xl text-ink font-semibold tracking-[0.15em] mb-8">
          당신의 두뇌 ON 하시겠습니까?
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-1 md:gap-x-2 max-w-4xl mb-6">
          {['D', 'O', ':', 'N', 'E'].map((char, i) => (
            <motion.span
              key={`pre-${char}-${i}`}
              className="font-display text-3xl md:text-5xl lg:text-3xl font-bold uppercase text-ink"
              initial={{ opacity: 0.12, color: '#8B8E94' }}
              animate={
                phase !== 'idle'
                  ? { opacity: 1, color: '#101113', textShadow: '0 0 12px rgba(238,93,12,0.25)' }
                  : { opacity: 0.12, color: '#8B8E94', textShadow: 'none' }
              }
              transition={{ duration: 0.5, delay: phase !== 'idle' ? 0.1 + i * 0.05 : 0 }}
            >
              {char}
            </motion.span>
          ))}

          <button
            type="button"
            onClick={onPowerClick}
            disabled={disabled || phase !== 'idle'}
            className="relative mx-1 flex items-center justify-center p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-neo-cyan focus-visible:ring-offset-2 clip-chamfer disabled:cursor-default"
            aria-label="전원 켜기"
          >
            <Image
              src="/brand/dolab-symbol.png"
              alt=""
              width={80}
              height={80}
              className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-[0_0_12px_rgba(238,93,12,0.6)]"
              priority
            />
            {phase === 'converge' && (
              <motion.span
                className="absolute inset-0 bg-signal/20 clip-chamfer"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            )}
          </button>

          {['N'].map((char) => (
            <motion.span
              key={`post-${char}`}
              className="font-display text-3xl md:text-5xl lg:text-3xl font-bold uppercase text-ink"
              initial={{ opacity: 0.12, color: '#8B8E94' }}
              animate={
                phase !== 'idle'
                  ? { opacity: 1, color: '#101113', textShadow: '0 0 12px rgba(238,93,12,0.25)' }
                  : { opacity: 0.12, color: '#8B8E94', textShadow: 'none' }
              }
              transition={{ duration: 0.5, delay: phase !== 'idle' ? 0.35 : 0 }}
            >
              {char}
            </motion.span>
          ))}

          <span className="w-3 md:w-4" />

          <motion.span
            className="font-body text-2xl md:text-4xl lg:text-3xl font-bold uppercase tracking-widest text-ink"
            initial={{ opacity: 0.12, color: '#8B8E94' }}
            animate={
              phase !== 'idle'
                ? { opacity: 1, color: '#101113', textShadow: '0 0 12px rgba(238,93,12,0.25)' }
                : { opacity: 0.12, color: '#8B8E94', textShadow: 'none' }
            }
            transition={{ duration: 0.5, delay: phase !== 'idle' ? 0.45 : 0 }}
          >
            PROJECT
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}
