'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function NewGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [playerCount, setPlayerCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    if (sessionId) {
      loadSessionInfo();
    }
  }, [sessionId]);

  const loadSessionInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      setSessionInfo(data);
    } catch (err) {
      console.error('세션 정보 로드 실패:', err);
    }
  };

  const handleCreateGame = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      // initialize_poker_game 함수 호출
      const { data, error } = await supabase.rpc('initialize_poker_game', {
        p_session_id: sessionId,
        p_player_count: playerCount
      });

      if (error) throw error;

      // 생성된 게임으로 이동
      router.push(`/game/manager/${data}`);
    } catch (err) {
      console.error('게임 생성 실패:', err);
      alert('게임 생성에 실패했습니다: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionInfo) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-2xl">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🎮 새 게임 생성</h1>

        <div className="bg-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-orange-500">세션 정보</h2>
          <div className="space-y-3 text-lg">
            <div className="flex justify-between">
              <span className="text-gray-400">게임명:</span>
              <span className="font-semibold">{sessionInfo.game_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">날짜:</span>
              <span>{sessionInfo.session_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">시간:</span>
              <span>{sessionInfo.session_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">세션 ID:</span>
              <span className="text-sm text-gray-400">{sessionInfo.session_id}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-orange-500">플레이어 수 설정</h2>
          
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-orange-500 mb-4">
              {playerCount}명
            </div>
            <input
              type="range"
              min="8"
              max="12"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-2">
              <span>8명</span>
              <span>12명</span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {[8, 9, 10, 11, 12].map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                className={`py-4 rounded-lg font-bold text-xl transition-all ${
                  playerCount === count
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-bold transition-colors"
          >
            ← 취소
          </button>
          <button
            onClick={handleCreateGame}
            disabled={loading}
            className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 rounded-lg text-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '생성 중...' : '게임 시작 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
