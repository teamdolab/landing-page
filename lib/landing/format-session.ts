import type { SessionAvailability } from '@/lib/supabase';

/** 세션 시작~종료 시간 (150분) */
export function formatSessionTimeRange(sessionTime: string): string {
  const start = sessionTime?.slice(0, 5) || '';
  if (!start) return sessionTime || '';
  const [h, m] = start.split(':').map(Number);
  const endMin = h * 60 + m + 150;
  return `${start}-${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
}

/** SCHEDULE 행 표시용 날짜·요일 파싱 (session_date: YYYY-MM-DD 또는 MM.DD) */
export function formatScheduleDisplay(session: SessionAvailability): { date: string; dow: string; time: string } {
  const time = session.session_time?.slice(0, 5) || '';
  const raw = session.session_date || '';
  if (/^\d{2}\.\d{2}$/.test(raw)) {
    return { date: raw, dow: '', time };
  }
  const d = new Date(raw + 'T12:00:00');
  if (Number.isNaN(d.getTime())) {
    return { date: raw, dow: '', time };
  }
  const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return { date, dow, time };
}

export function getSessionDisplayStatus(session: SessionAvailability): 'SOLD OUT' | 'tight' | 'ok' {
  const isClosed = session.status === '마감' || session.available_slots <= 0;
  if (isClosed) return 'SOLD OUT';
  if (session.available_slots <= 2) return 'tight';
  return 'ok';
}
