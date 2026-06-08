import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { PostHogProvider } from "./providers/PostHogProvider";
import { PageViewTracker } from "./_components/PageViewTracker";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-share-tech-mono",
});

const ibmPlexSansKR = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
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
      className={`${orbitron.variable} ${shareTechMono.variable} ${ibmPlexSansKR.variable}`}
    >
      <body className={`${ibmPlexSansKR.className} antialiased`}>
        {/* GA4 */}
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
