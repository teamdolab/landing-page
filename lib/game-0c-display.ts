import type { Game0cPhase } from '@/lib/game-0c-types';

const PHASE_LABELS: Record<Game0cPhase, string> = {
  WAITING: '대기중',
  ROUND_OPEN: '라운드시작',
  BIDDING: '입찰중',
  FORCE: '강제접촉',
  OPEN: '자유시간',
  CLOSED: '종료',
  FINISHED: '게임 종료',
};

export function game0cPhaseLabel(phase: Game0cPhase | null | undefined): string {
  if (!phase) return '-';
  return PHASE_LABELS[phase] ?? phase;
}

export function formatCountdown(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
