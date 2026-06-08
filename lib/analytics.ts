/**
 * GA4 + PostHog 공통 분석 헬퍼
 * 환경변수 없으면 조용히 비활성화 (에러 X)
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** GA4 커스텀 이벤트 전송 */
export function gtagEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}

/** GA4 페이지뷰 (App Router 수동 호출용) */
export function gtagPageView(path: string): void {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: document.title,
  });
}
