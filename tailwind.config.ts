import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design System - DO:LAB
        "phantom-white": "#F2F4F6",
        "deep-dark": "#1A1A1A",
        "neon-orange": "#FF4F00",
        "text-main": "#1a1a1a",
        "text-sub": "#555555",
        "text-light": "#FFFFFF",
      },
      fontFamily: {
        orbitron: ["var(--font-orbitron)", "sans-serif"],
        "share-tech-mono": ["var(--font-share-tech-mono)", "monospace"],
        "noto-sans-kr": ["var(--font-body)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      boxShadow: {
        "neon-orange":
          "0 0 10px rgba(255, 79, 0, 0.5), 0 0 20px rgba(255, 79, 0, 0.3)",
        "neon-orange-strong":
          "0 0 15px rgba(255, 79, 0, 0.8), 0 0 30px rgba(255, 79, 0, 0.5)",
      },
      clipPath: {
        "cut-corner": "polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)",
        "cut-corner-both":
          "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
        "cut-corner-left": "polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)",
      },
    },
  },
  plugins: [],
};

export default config;
