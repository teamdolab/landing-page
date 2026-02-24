'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Session {
  session_id: string;
  game_name: string;
  session_date: string;
  session_time: string;
  status: string;
}

export default function GameManagerPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('세션 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (sessionId: string) => {
    try {
      // 해당 세션의 게임이 이미 있는지 확인
      const { data: existingGame } = await supabase
        .from('game_0a')
        .select('game_id')
        .eq('session_id', sessionId)
        .single();

      if (existingGame) {
        // 기존 게임으로 이동
        router.push(`/game/manager/${existingGame.game_id}`);
      } else {
        // 새 게임 생성 페이지로 이동
        router.push(`/game/manager/new?session=${sessionId}`);
      }
    } catch (err) {
      console.error('게임 확인 실패:', err);
      // 에러 시에도 새 게임 생성 페이지로
      router.push(`/game/manager/new?session=${sessionId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-2xl">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🎮 게임 진행 관리</h1>
        
        <div className="mb-6 text-gray-400">
          <p>진행할 게임 세션을 선택하세요</p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-xl text-gray-400">등록된 세션이 없습니다.</p>
            <p className="mt-4 text-gray-500">어드민 페이지에서 게임 세션을 먼저 생성하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => handleSessionClick(session.session_id)}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition-all transform hover:scale-105 border-2 border-transparent hover:border-orange-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-bold text-orange-500">
                    {session.game_name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      session.status === '모집중'
                        ? 'bg-green-600'
                        : 'bg-gray-600'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">📅</span>
                    <span>{session.session_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">🕐</span>
                    <span>{session.session_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">🆔</span>
                    <span className="text-sm text-gray-400">{session.session_id}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-700">
                  <span className="text-orange-500 font-semibold">
                    게임 시작 →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => router.push('/admin')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            ← 어드민 페이지로
          </button>
        </div>
      </div>
    </div>
  );
}
