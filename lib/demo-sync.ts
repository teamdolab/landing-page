/** 데모 송출 ↔ 컨트롤 동기화용 BroadcastChannel 이름 */
export const DEMO_CHANNEL = 'dolab-demo-game';

export type DemoGameState = {
  game_id: string;
  session_id: string;
  player_count: number;
  current_round: number;
  current_step: number;
  info_text: string | null;
  timer_seconds: number;
  timer_active: boolean;
  timer_end?: boolean; // true면 송출용 타이머에 "종료" 표시
  current_player: number | null;
  community_cards: string[];
  players: Array<{
    player_number: number;
    is_first: boolean;
    is_candidate: boolean;
    revealed_cards: string[];
    total_score: number;
    round_scores: number[];
  }>;
  votes?: Record<string, Array<{ voter: number; voted_for: number | null }>>;
  round_winners?: Record<string, number[]>; // round -> winner player numbers
  final_winners?: number[]; // 최종 우승자들 (결과 공개 시 설정)
  status: string; // '결과선택중' = 집계중, '완료' = 결과 공개됨
};

export function broadcastDemoGame(state: DemoGameState) {
  if (typeof window === 'undefined') return;
  try {
    const channel = new BroadcastChannel(DEMO_CHANNEL);
    channel.postMessage({ type: 'game_update', data: state });
    channel.close();
  } catch {
    // BroadcastChannel 미지원 시 무시
  }
}

export function subscribeDemoGame(callback: (state: DemoGameState) => void) {
  if (typeof window === 'undefined') return () => {};
  try {
    const channel = new BroadcastChannel(DEMO_CHANNEL);
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'game_update' && e.data?.data) {
        callback(e.data.data);
      }
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  } catch {
    return () => {};
  }
}
