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
        paper: "#EFF0F2",
        "paper-2": "#F6F7F8",
        white: "#FCFCFD",
        ink: "#101113",
        "ink-2": "#55575C",
        gray: "#8B8E94",
        signal: "#EE5D0C",
        "signal-deep": "#C74B05",
        "neo-cyan": "#2BD6E4",
        line: "rgba(16,17,19,0.12)",
        "line-soft": "rgba(16,17,19,0.06)",
        poker: "#E23B4E",
        ship: "#6B46D9",
        zombie: "#37E0A0",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "28px",
        7: "40px",
        8: "56px",
      },
      fontSize: {
        micro: ["10.5px", { lineHeight: "1.4" }],
        xs: ["11.5px", { lineHeight: "1.4" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["15px", { lineHeight: "1.6" }],
        md: ["17px", { lineHeight: "1.6" }],
        lg: ["20px", { lineHeight: "1.4" }],
        xl: ["26px", { lineHeight: "1.2" }],
        "2xl": ["clamp(30px,4vw,52px)", { lineHeight: "1.1" }],
        "3xl": ["clamp(34px,5.6vw,76px)", { lineHeight: "1.05" }],
        display: ["clamp(72px,13vw,200px)", { lineHeight: "0.95" }],
      },
      fontFamily: {
        body: [
          "var(--font-body)",
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "IBM Plex Mono", "monospace"],
        display: ["var(--font-display)", "Chakra Petch", "sans-serif"],
      },
      transitionTimingFunction: {
        "ease-out-v12": "cubic-bezier(.2,.7,.2,1)",
        "ease-in-v12": "cubic-bezier(.55,0,.7,.9)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "300ms",
        slow: "800ms",
        cinematic: "1900ms",
      },
      boxShadow: {
        signal: "0 0 10px rgba(238, 93, 12, 0.5), 0 0 20px rgba(238, 93, 12, 0.3)",
        "signal-strong":
          "0 0 15px rgba(238, 93, 12, 0.8), 0 0 30px rgba(238, 93, 12, 0.5)",
      },
      clipPath: {
        chamfer:
          "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
      },
      backgroundImage: {
        "grid-v12":
          "linear-gradient(to right, rgba(16,17,19,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,17,19,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [],
};

export default config;
