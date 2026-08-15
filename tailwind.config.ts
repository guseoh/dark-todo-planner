import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0f172a",
          900: "#111827",
          850: "#172033",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f8fafc",
        },
        accent: {
          600: "#5457e8",
          500: "#6366f1",
          400: "#8b5cf6",
          300: "#a5b4fc",
          200: "#c7d2fe",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(2, 6, 23, 0.24)",
      },
    },
  },
  plugins: [],
} satisfies Config;
