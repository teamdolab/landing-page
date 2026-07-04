import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { PostHogProvider } from "./providers/PostHogProvider";
import { PageViewTracker } from "./_components/PageViewTracker";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "DO:LAB - 소셜전략게임 연구소",
  description: "당신의 두뇌 ON. DO:NEON PROJECT",
  openGraph: {
    title: "DO:LAB - 소셜전략게임 연구소",
    description: "당신의 두뇌 ON. DO:NEON PROJECT",
    url: "https://do-lab.co.kr",
    siteName: "DO:LAB",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DO:LAB - 소셜전략게임 연구소",
    description: "당신의 두뇌 ON. DO:NEON PROJECT",
  },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${chakraPetch.variable} ${ibmPlexMono.variable}`}
      style={{ ["--font-body" as string]: "'Pretendard Variable', Pretendard, system-ui, sans-serif" }}
    >
      <body className="font-body antialiased">
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { send_page_view: false });
              `}
            </Script>
          </>
        )}

        <PostHogProvider>
          <PageViewTracker />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
