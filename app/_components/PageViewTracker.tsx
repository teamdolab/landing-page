'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { gtagPageView } from '@/lib/analytics';

function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    const qs = searchParams.toString();
    const url = pathname + (qs ? `?${qs}` : '');

    // GA4 페이지뷰
    gtagPageView(url);

    // PostHog 페이지뷰
    if (posthog) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

// useSearchParams는 Suspense 필요
import { Suspense } from 'react';

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
