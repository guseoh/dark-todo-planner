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
          500: "#64748b",
          400: "#94a3b8",
          100: "#f8fafc",
        },
        accent: {
          500: "#6366f1",
          600: "#5457e8",
          400: "#8b5cf6",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(2, 6, 23, 0.28)",
      },
    },
  },
  plugins: [],
} satisfies Config;
