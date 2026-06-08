'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useState } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      setReady(true);
      return;
    }
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: false, // PageViewTracker에서 수동 처리
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
      });
    }
    setReady(true);
  }, []);

  if (!ready) return <>{children}</>;

  // 환경변수 없으면 Provider 없이 children만 렌더
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return <>{children}</>;

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
