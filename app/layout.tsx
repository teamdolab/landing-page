import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

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
  description: "당신의 두뇌 ON. 대선포커 참가 신청",
  openGraph: {
    title: "DO:LAB - 소셜전략게임 연구소",
    description: "당신의 두뇌 ON. 대선포커 참가 신청",
    url: "https://do-lab.co.kr",
    siteName: "DO:LAB",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DO:LAB - 소셜전략게임 연구소",
    description: "당신의 두뇌 ON. 대선포커 참가 신청",
  },
};

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
        {children}
      </body>
    </html>
  );
}
