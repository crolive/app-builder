import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0C0F",
        panel: {
          DEFAULT: "#12161B",
          raised: "#171C23",
        },
        border: {
          DEFAULT: "#232A33",
          strong: "#2E3742",
        },
        text: {
          primary: "#F2F4F7",
          secondary: "#A3AEBB",
          tertiary: "#6B7683",
        },
        accent: {
          positive: "#3DDC84",
          alert: "#FF5C48",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        lift: "0 12px 24px -8px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
